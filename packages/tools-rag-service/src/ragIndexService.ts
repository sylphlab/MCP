import type { RagServiceConfig } from './types.js';
import { IndexManager, type VectorDbConfig, VectorDbProvider } from '@sylphlab/tools-rag';
import chokidar from 'chokidar';
import path from 'node:path';
import fs from 'node:fs/promises';
import ignore from 'ignore';
import type { Ignore } from 'ignore';
import { chunkCodeAst, generateEmbeddings, detectLanguage, type Chunk, type IndexedItem, type IEmbeddingFunction, EmbeddingModelProvider, OllamaEmbeddingFunction, MockEmbeddingFunction, HttpEmbeddingFunction } from '@sylphlab/tools-rag';
// Keep debounce for post-scan changes
import { debounce, type DebouncedFunc } from 'lodash-es';

// Helper type for Document
interface Document {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
}

// Simple sleep function for waiting loop (might not be needed anymore)
// const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class RagIndexService {
  private config: RagServiceConfig;
  private workspaceRoot: string;
  private indexManager: IndexManager | null = null;
  private embeddingFn: IEmbeddingFunction | null = null;
  private watcher: chokidar.FSWatcher | null = null;
  private isInitialized = false;
  private initialScanComplete = false; // Renamed to initialSyncComplete conceptually
  // Unified queue for all file processing (stores absolute paths)
  private fileProcessingQueue: string[] = [];
  private isProcessingQueue = false; // Flag to ensure sequential processing
  // Removed initial scan state variables (processedChunkIdsDuringScan, initialDbIds)
  private totalFilesFoundDuringScan: number | null = null; // Track total files found by Chokidar initially
  private processedFilesCount = 0; // Track processed files for progress
  private gitIgnoreFilter: Ignore | null = null; // Parsed .gitignore content
  // Debounce only for file changes *after* initial sync
  private debouncedIndexFile: DebouncedFunc<(filePath: string) => Promise<void>>;

  constructor(config: RagServiceConfig, workspaceRoot: string) {
    this.config = config;
    this.workspaceRoot = workspaceRoot;

    // Debounce for regular file changes (post-initial sync)
    this.debouncedIndexFile = debounce(
      // No longer need isInitialScan flag
      (filePath) => this.indexSingleFile(filePath),
      this.config.debounceDelay || 2000,
      { leading: false, trailing: true }
    );

    console.log('RagIndexService created with config:', this.config);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) { return; }
    console.log('Initializing RagIndexService...');
    // Initialize Embedding Function
    const embeddingConfig = this.config.embedding;
    if (embeddingConfig.provider === EmbeddingModelProvider.Ollama) {
      this.embeddingFn = new OllamaEmbeddingFunction(embeddingConfig.modelName, embeddingConfig.baseURL);
    } else if (embeddingConfig.provider === EmbeddingModelProvider.Http) {
        this.embeddingFn = new HttpEmbeddingFunction(embeddingConfig.url, embeddingConfig.headers, embeddingConfig.batchSize);
    } else {
      this.embeddingFn = new MockEmbeddingFunction(embeddingConfig.mockDimension);
      console.warn(`Using MockEmbeddingFunction (dim: ${embeddingConfig.mockDimension}) as provider is ${embeddingConfig.provider}`);
    }
    // Initialize IndexManager
    if (!this.embeddingFn) { throw new Error('Embedding function failed to initialize.'); }
    this.indexManager = await IndexManager.create(this.config.vectorDb, this.embeddingFn);
    // Load .gitignore filter instance *during* initialization
    await this.loadGitIgnore(); // Load and store the filter instance
    this.isInitialized = true;
    console.log('RagIndexService initialized successfully.');
  }

  async startWatching(): Promise<void> {
    if (!this.isInitialized || !this.indexManager) {
        console.error("Cannot start watching: Service not initialized.");
        return;
     }
    if (!this.config.autoWatchEnabled) {
        console.log("Auto watching disabled by config.");
        return;
     }
    if (this.watcher) {
        console.log("Watcher already running.");
        return;
     }

    console.log('Starting initial sync and file watcher using Chokidar...');
    this.initialScanComplete = false;
    const initialFilesFound: string[] = []; // Temp list to collect files during scan (absolute paths)
    this.fileProcessingQueue = []; // Reset main queue
    this.isProcessingQueue = false;
    this.processedFilesCount = 0;
    this.totalFilesFoundDuringScan = null;

    // Get initial DB file states (filePath -> lastMtime)
    let dbFileStates = new Map<string, number>();
    try {
        console.log("Fetching initial DB file states...");
        // biome-ignore lint/suspicious/noExplicitAny: Temporary workaround for TS type resolution issue
        dbFileStates = await (this.indexManager as any).getAllFileStates();
        console.log(`Found ${dbFileStates.size} file states in DB.`);
    } catch (error) {
        console.error("Failed to fetch initial DB file states during startup. Stopping service.", error);
        // Re-throw the error to prevent the service from continuing without a valid DB state
        throw error;
    }

    // --- Prepare ignore patterns for Chokidar ---
    const chokidarIgnorePatterns: string[] = [];
    // 1. Add common ignores
    chokidarIgnorePatterns.push('**/node_modules/**', '**/.git/**', '**/dist/**', '**/.*', '.*');
    // 2. Add patterns from config.excludePatterns
    if (this.config.excludePatterns) {
        chokidarIgnorePatterns.push(...this.config.excludePatterns);
    }
    // 3. Add patterns from .gitignore if loaded
    if (this.config.respectGitignore && this.gitIgnoreFilter) {
        // biome-ignore lint/suspicious/noExplicitAny: Accessing internal property for pattern
        const gitignorePatterns = (this.gitIgnoreFilter as any)._rules?.map((rule: any) => rule.origin) || [];
        chokidarIgnorePatterns.push(...gitignorePatterns.filter((p: string | undefined): p is string => !!p));
    }
    // Remove duplicates
    const finalIgnoredPaths = [...new Set(chokidarIgnorePatterns)];
    console.log(`[Chokidar Options] Ignoring patterns: ${JSON.stringify(finalIgnoredPaths)}`);
    // --- End Prepare ignore patterns ---

    this.watcher = chokidar.watch(this.workspaceRoot, {
      ignored: finalIgnoredPaths, // Pass the combined list
      persistent: true,
      ignoreInitial: false, // Process initial 'add' events
      awaitWriteFinish: {
        stabilityThreshold: this.config.debounceDelay || 2000,
        pollInterval: 100
      }
    });

    this.watcher
      .on('add', (filePath: string) => {
          // Collect all files found during the initial scan phase
          if (!this.initialScanComplete) {
              initialFilesFound.push(filePath); // Store absolute path
          } else {
              // After initial sync is marked complete, handle 'add' like a normal change event
              this.handleFileEvent('add', filePath); // filePath is absolute
          }
      })
      .on('change', (filePath: string) => this.handleFileEvent('change', filePath))
      .on('unlink', (filePath: string) => this.handleFileEvent('unlink', filePath))
      .on('error', (error: Error) => console.error(`Watcher error: ${error}`))
      .on('ready', async () => {
          console.log(`Chokidar initial scan reported complete. Found ${initialFilesFound.length} files.`);
          this.totalFilesFoundDuringScan = initialFilesFound.length;

          const filesToIndex: string[] = []; // Absolute paths
          const filesToDelete: string[] = []; // Absolute paths
          const foundRelativePaths = new Set<string>();

          // Compare FS state (initialFilesFound) with DB state (dbFileStates)
          console.log('Comparing filesystem state with DB state...');
          for (const absolutePath of initialFilesFound) {
              const relativePath = path.relative(this.workspaceRoot, absolutePath);
              foundRelativePaths.add(relativePath);
              try {
                  const stats = await fs.stat(absolutePath);
                  const currentMtime = stats.mtimeMs;
                  const lastMtime = dbFileStates.get(relativePath);

                  if (lastMtime === undefined || currentMtime > lastMtime) {
                      filesToIndex.push(absolutePath); // Add absolute path
                  }
                  // else: file exists and mtime is not newer, skip.
              } catch (statError) {
                  console.warn(`Failed to stat file ${relativePath} during initial sync comparison:`, statError);
                  // Treat as potentially modified if stat fails? Or skip? Let's add to index queue to be safe.
                  filesToIndex.push(absolutePath);
              }
          }

          // Identify files deleted while offline
          for (const relativePath of dbFileStates.keys()) {
              if (!foundRelativePaths.has(relativePath)) {
                  filesToDelete.push(path.join(this.workspaceRoot, relativePath)); // Add absolute path
              }
          }

          console.log(`Initial sync: ${filesToIndex.length} files to index/update, ${filesToDelete.length} files to delete.`);

          // Mark initial sync comparison complete *before* queueing.
          // Watcher will now handle new events normally.
          this.initialScanComplete = true;
          console.log('Initial sync comparison complete. Watcher now handling real-time events.');

          // Queue indexing tasks
          if (filesToIndex.length > 0) {
              this.fileProcessingQueue.push(...filesToIndex);
              this.ensureQueueProcessing(); // Start consumer if not running
          }

          // Execute deletion tasks (can be done async, maybe batched later)
          if (filesToDelete.length > 0 && this.indexManager) {
              console.log(`Deleting ${filesToDelete.length} files identified as deleted during offline period...`);
              // We call deleteFileIndex which expects absolute path
              const deletePromises = filesToDelete.map(absPath => this.deleteFileIndex(absPath));
              Promise.allSettled(deletePromises).then(results => {
                  const failedDeletes = results.filter(r => r.status === 'rejected');
                  if (failedDeletes.length > 0) {
                      console.error(`Failed to delete ${failedDeletes.length} files during initial sync cleanup.`);
                  } else {
                      console.log('Finished initial sync deletion process.'); // Fixed Biome warning
                  }
              });
          } else if (filesToDelete.length > 0 && !this.indexManager) {
              console.error("Cannot delete files during initial sync: IndexManager not available.");
          }

          // No longer need the old stale cleanup logic or waiting loop here.
          // The consumer loop will process the queued filesToIndex.
      });
  }

  async stopWatching(): Promise<void> {
    if (this.watcher) {
      console.log('Stopping file watcher...');
      await this.watcher.close();
      this.watcher = null;
      console.log('File watcher stopped.');
    }
    // Cancel any pending debounced calls
    this.debouncedIndexFile.cancel();
  }

  /** Unified handler for all file events */
  private handleFileEvent(eventType: 'add' | 'change' | 'unlink', filePath: string): void {
    // filePath is absolute path from chokidar

    if (eventType === 'add' || eventType === 'change') {
        // Use debounced function for add/change events after initial sync
        this.debouncedIndexFile(filePath);
    } else if (eventType === 'unlink') {
        // Cancel any pending debounced index for this file
        this.debouncedIndexFile.cancel();
        // Process unlink immediately
        this.deleteFileIndex(filePath); // filePath is absolute
    }
  }

  /** Ensures the processing queue loop is running if needed */
  private ensureQueueProcessing(): void {
      if (!this.isProcessingQueue) {
          this.processQueueLoop(); // Start the loop asynchronously
      }
  }

  /** Processes the file queue sequentially */
  private async processQueueLoop(): Promise<void> {
      if (this.isProcessingQueue) return;
      this.isProcessingQueue = true;
      // console.log(`Starting processing queue loop (${this.fileProcessingQueue.length} items)...`);

      while(this.fileProcessingQueue.length > 0) {
          const absolutePath = this.fileProcessingQueue.shift(); // Get absolute path
          if (absolutePath) {
              // No longer need isInitial flag for processing logic
              this.processedFilesCount++; // Increment for all processed files now
              const relativePath = path.relative(this.workspaceRoot, absolutePath);
              const queueLength = this.fileProcessingQueue.length;

              // Simplified logging
              console.log(`[Queue: ${queueLength}] Processing ${relativePath}...`);

              await this.indexSingleFile(absolutePath); // Pass absolute path
          }
      }

      // console.log("Finished processing queue loop.");
      this.isProcessingQueue = false;
  }


   // Removed shouldIgnore method

  /** Loads .gitignore content and creates the filter instance */
  private async loadGitIgnore(): Promise<void> {
    const gitignorePath = path.join(this.workspaceRoot, '.gitignore');
    try {
      const content = await fs.readFile(gitignorePath, 'utf-8');
      this.gitIgnoreFilter = ignore.default().add(content); // Reverted to ignore.default()
      console.log('.gitignore file loaded and parsed.');
    } catch (error: any) {
      if (error.code !== 'ENOENT') { console.warn('Error reading .gitignore:', error); }
      else { console.log('.gitignore file not found, skipping.'); }
      this.gitIgnoreFilter = null; // Ensure it's null if loading fails
    }
  }

  /**
   * Indexes or re-indexes a single file.
   */
  private async indexSingleFile(absolutePath: string): Promise<void> { // Takes absolute path
     if (!this.isInitialized || !this.indexManager || !this.embeddingFn) {
         console.error('Cannot index file, service not initialized.');
         return;
     }

    const relativePath = path.relative(this.workspaceRoot, absolutePath);
    // Ignore check is now handled by chokidar at event source

    try {
        const stats = await fs.stat(absolutePath);
        const currentMtime = stats.mtimeMs;

        // --- Incremental Check Removed ---
        // The decision to index is now made during the initial sync comparison
        // or by real-time events after the initial sync.

        const content = await fs.readFile(absolutePath, 'utf-8');
        const doc: Document = { id: relativePath, content: content, metadata: { filePath: relativePath, fileMtime: currentMtime } };
        const language = detectLanguage(relativePath);
        const chunks = await chunkCodeAst(doc.content, language, this.config.chunkingOptions, doc.metadata);

        if (chunks.length === 0) {
            // If a file becomes empty or unchunkable, delete its previous entries.
            // This handles cases where content is removed or becomes invalid.
            console.log(`No chunks generated for ${relativePath}, attempting to delete existing entries.`);
            await this.deleteFileIndex(absolutePath); // Use absolute path for consistency
            return;
        }

        // Process in batches
        const embeddingBatchSize = (this.config.embedding as any)?.batchSize || 50;
        for (let j = 0; j < chunks.length; j += embeddingBatchSize) {
            const chunkBatch = chunks.slice(j, j + embeddingBatchSize);

            let vectors: number[][];
            try {
                vectors = await this.embeddingFn.generate(chunkBatch.map((c) => c.content));
            } catch (embeddingError) {
                console.error(`Error generating embeddings for batch in ${relativePath}:`, embeddingError);
                continue; // Skip this batch on embedding error
            }

            if (vectors.length !== chunkBatch.length) {
                console.error(`Mismatch in embedding batch for ${relativePath}. Skipping batch.`);
                continue; // Skip this batch
            }

            const indexedItems: IndexedItem[] = chunkBatch.map((chunk, index) => {
                const chunkId = `${relativePath}::${chunk.metadata?.chunkIndex ?? (j + index)}`;
                // Ensure fileMtime is included and handle null language for Pinecone
                const finalMetadata = {
                    ...chunk.metadata,
                    fileMtime: currentMtime,
                    // Explicitly set language, replacing null with "unknown"
                    language: language === null ? "unknown" : language
                };
                // Remove processedChunkIdsDuringScan logic
                return { ...chunk, metadata: finalMetadata, id: chunkId, vector: vectors[index] };
            });

            try {
                await this.indexManager.upsertItems(indexedItems);
            } catch (upsertError) {
                console.error(`Error upserting chunk batch for ${relativePath}:`, upsertError);
                // Consider if we should retry or just log and continue
            }
        }

    } catch (error: unknown) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
            // File might have been deleted between event and processing
            console.log(`File ${relativePath} not found during indexing (likely deleted recently). Attempting cleanup.`);
            await this.deleteFileIndex(absolutePath); // Use absolute path
        } else {
            console.error(`Error indexing file ${relativePath}:`, error instanceof Error ? error.message : error);
        }
    }
  }

  /** Deletes index entries for a given absolute file path. */
  private async deleteFileIndex(absolutePath: string): Promise<void> { // Takes absolute path
     if (!this.isInitialized || !this.indexManager) {
         console.error('Cannot delete file index, service not initialized.');
         return;
     }
     // No longer need initialScanComplete check here

    const relativePath = path.relative(this.workspaceRoot, absolutePath);
    console.log(`Deleting index entries for file: ${relativePath}`);
    try {
        // Use relativePath for the metadata filter
        await this.indexManager.deleteWhere({ filePath: relativePath });
        console.log(`Attempted deletion of chunks for file: ${relativePath}`);
    } catch (error: unknown) {
         console.error(`Error deleting index entries for ${relativePath}:`, error instanceof Error ? error.message : error);
    }
  }

  // --- Public Accessors and Status ---
  public get indexManagerInstance(): IndexManager | null {
    return this.indexManager;
  }

  public getServiceStatus(): {
      state: 'Initializing' | 'Initial File Discovery' | 'Initial Processing' | 'Watching' | 'Processing Changes' | 'Idle' | 'Stopping'; // Updated states
      initialized: boolean;
      initialScanComplete: boolean; // Represents completion of initial sync comparison and queuing
      watching: boolean;
      filesInQueue: number;
      processedFiles: number; // Total files processed since start (including initial sync)
      totalFilesInitialScan: number | null; // Total files found by Chokidar initially
  } {
      let state: 'Initializing' | 'Initial File Discovery' | 'Initial Processing' | 'Watching' | 'Processing Changes' | 'Idle' | 'Stopping' = 'Idle';
      if (!this.isInitialized) {
          state = 'Initializing';
      } else if (!this.initialScanComplete) {
          // If watcher exists but totalFiles is null, chokidar is still scanning (discovery phase)
          if (this.watcher && this.totalFilesFoundDuringScan === null) {
              state = 'Initial File Discovery';
          }
          // If watcher exists and totalFiles is set, OR if queue is processing/has items
          // it means we are processing the initial batch identified by comparison.
          else if (this.watcher && (this.isProcessingQueue || this.fileProcessingQueue.length > 0)) {
               state = 'Initial Processing';
          }
          // If watcher exists, totalFiles is set, but queue is empty and not processing (transient state before initialScanComplete=true)
          else if (this.watcher && this.totalFilesFoundDuringScan !== null) {
               state = 'Initial Processing'; // Still considered processing until flag is set
          }
          // Fallback if watcher doesn't exist but scan not complete (shouldn't happen)
          else {
               state = 'Initializing'; // Or some error state?
          }
      } else if (this.watcher) {
          // After initial sync, if queue still has items (e.g., from watch events), show processing changes
          state = this.isProcessingQueue || this.fileProcessingQueue.length > 0 ? 'Processing Changes' : 'Watching';
      } else if (this.isProcessingQueue || this.fileProcessingQueue.length > 0) {
          // If watcher stopped but queue still processing
          state = 'Processing Changes'; // Or 'Stopping'?
      }

      return {
          state: state,
          initialized: this.isInitialized,
          initialScanComplete: this.initialScanComplete,
          watching: !!this.watcher,
          filesInQueue: this.fileProcessingQueue.length,
          processedFiles: this.processedFilesCount,
          totalFilesInitialScan: this.totalFilesFoundDuringScan,
      };
  }
}