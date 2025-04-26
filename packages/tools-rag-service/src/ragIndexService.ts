import type { RagServiceConfig } from './types.js';
import { IndexManager, type VectorDbConfig, VectorDbProvider } from '@sylphlab/tools-rag';
import chokidar from 'chokidar';
import path from 'node:path';
import fs from 'node:fs/promises';
import ignore from 'ignore';
import type { Ignore } from 'ignore';
import { chunkCodeAst, generateEmbeddings, detectLanguage, type Chunk, type IndexedItem, type IEmbeddingFunction, EmbeddingModelProvider, OllamaEmbeddingFunction, MockEmbeddingFunction, HttpEmbeddingFunction } from '@sylphlab/tools-rag';
import { minimatch } from 'minimatch';
// Keep debounce for post-scan changes
import { debounce, type DebouncedFunc } from 'lodash-es';

// Helper type for Document
interface Document {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
}

// Simple sleep function for waiting loop
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class RagIndexService {
  private config: RagServiceConfig;
  private workspaceRoot: string;
  private indexManager: IndexManager | null = null;
  private embeddingFn: IEmbeddingFunction | null = null;
  private watcher: chokidar.FSWatcher | null = null;
  private isInitialized = false;
  private initialScanComplete = false;
  // Unified queue for all file processing
  private fileProcessingQueue: string[] = [];
  private isProcessingQueue = false; // Flag to ensure sequential processing
  // For initial scan stale check
  private processedChunkIdsDuringScan: Set<string> | null = null;
  private initialDbIds: Set<string> | null = null;
  private totalFilesFoundDuringScan: number | null = null; // Track total files found in initial scan
  private processedFilesCount = 0; // Track processed files for progress
  private gitIgnoreFilter: Ignore | null = null; // Parsed .gitignore content
  // Debounce only for file changes *after* initial scan
  private debouncedIndexFile: DebouncedFunc<(filePath: string) => Promise<void>>;

  constructor(config: RagServiceConfig, workspaceRoot: string) {
    this.config = config;
    this.workspaceRoot = workspaceRoot;

    // Debounce for regular file changes (post-initial scan)
    this.debouncedIndexFile = debounce(
      // Pass false for isInitialScan flag
      (filePath) => this.indexSingleFile(filePath, false),
      this.config.debounceDelay || 2000,
      { leading: false, trailing: true }
    );

    console.log('RagIndexService created with config:', this.config);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) { /* ... */ return; }
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
    if (!this.isInitialized || !this.indexManager) { /* ... */ return; }
    if (!this.config.autoWatchEnabled) { /* ... */ return; }
    if (this.watcher) { /* ... */ return; }

    console.log('Starting initial scan and file watcher using Chokidar...');
    this.initialScanComplete = false;
    const initialFilesFound: string[] = []; // Temp list to collect files during scan
    this.processedChunkIdsDuringScan = new Set<string>();
    this.fileProcessingQueue = []; // Reset main queue
    this.isProcessingQueue = false;
    this.processedFilesCount = 0;
    this.totalFilesFoundDuringScan = null;

    // Get initial DB IDs
    try {
        console.log("Fetching initial DB IDs...");
        const ids = await this.indexManager.getAllIds();
        this.initialDbIds = new Set(ids);
        console.log(`Found ${this.initialDbIds.size} existing IDs in DB.`);
    } catch (error) {
        console.error("Failed to fetch initial DB IDs. Stale data cleanup might be incomplete.", error);
        this.initialDbIds = new Set();
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
          // During initial scan phase, chokidar should have already filtered ignored files
          if (!this.initialScanComplete) {
              // No need for shouldIgnore check here anymore
              initialFilesFound.push(filePath); // Add directly to temp list
          } else {
              // After initial scan, handle 'add' like a normal change event
              this.handleFileEvent('add', filePath);
          }
      })
      .on('change', (filePath: string) => this.handleFileEvent('change', filePath))
      .on('unlink', (filePath: string) => this.handleFileEvent('unlink', filePath))
      .on('error', (error: Error) => console.error(`Watcher error: ${error}`))
      .on('ready', async () => {
          console.log(`Chokidar initial scan reported complete. Found ${initialFilesFound.length} files to process.`);
          this.totalFilesFoundDuringScan = initialFilesFound.length; // Store total for progress
          // Add all found files to the main processing queue
          this.fileProcessingQueue.push(...initialFilesFound);
          // Ensure the queue starts processing
          this.ensureQueueProcessing();

          console.log('Waiting for initial processing queue to complete before deleting stale data...');
          // Wait for the queue processing to finish
          while (this.isProcessingQueue || this.fileProcessingQueue.length > 0) {
              await sleep(200);
          }
          console.log('Initial processing queue finished.');

          this.initialScanComplete = true; // Mark scan complete *after* processing

          // Stale data cleanup
          const initialIds = this.initialDbIds;
          const processedIds = this.processedChunkIdsDuringScan;
          if (initialIds && processedIds && this.indexManager) {
              const staleIds = [...initialIds].filter(id => !processedIds.has(id));
              if (staleIds.length > 0) {
                  console.log(`Deleting ${staleIds.length} stale items found after initial scan...`);
                  try {
                      await this.indexManager.deleteItems(staleIds);
                      console.log("Stale items deleted successfully.");
                  } catch (deleteError) {
                      console.error("Error deleting stale items:", deleteError);
                  }
              } else {
                  console.log("No stale items found after initial scan.");
              }
          } else {
              console.warn("Could not perform stale data cleanup.");
          }
          this.initialDbIds = null;
          this.processedChunkIdsDuringScan = null; // Clear scan-specific set
          console.log('File watcher ready and watching for changes.');
      });
  }

  async stopWatching(): Promise<void> { /* ... (same as before) ... */
    if (this.watcher) {
      console.log('Stopping file watcher...');
      await this.watcher.close();
      this.watcher = null;
      console.log('File watcher stopped.');
    }
  }

  /** Unified handler for all file events */
  private handleFileEvent(eventType: 'add' | 'change' | 'unlink', filePath: string): void {
    // No need for shouldIgnore check here, chokidar should handle it
    // const relativePath = path.relative(this.workspaceRoot, filePath); // Removed
    // console.log(`File event: ${eventType} - ${filePath}`); // Log absolute path if needed

    if (eventType === 'add' || eventType === 'change') {
        // Add to the single queue for both initial scan and subsequent changes
        if (!this.fileProcessingQueue.includes(filePath)) {
            this.fileProcessingQueue.push(filePath);
        }
        this.ensureQueueProcessing(); // Start processing if not already running
    } else if (eventType === 'unlink') {
        // Only process unlink *after* initial scan is fully complete
        if (this.initialScanComplete) {
            // Handle delete immediately (or queue if preferred)
            this.deleteFileIndex(filePath);
        }
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
          const filePath = this.fileProcessingQueue.shift();
          if (filePath) {
              const isInitial = !this.initialScanComplete;
              // Only increment processed count during initial scan phase for progress reporting
              if (isInitial) {
                  this.processedFilesCount++;
              }
              const total = this.totalFilesFoundDuringScan ?? '?';
              const relativePath = path.relative(this.workspaceRoot, filePath);
              // Log progress differently based on phase
              if (isInitial) {
                  console.log(`[${this.processedFilesCount}/${total}] Processing ${relativePath}...`);
              } else {
                  console.log(`[Queue: ${this.fileProcessingQueue.length}] Processing changed file ${relativePath}...`);
              }
              await this.indexSingleFile(filePath, isInitial);
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
      this.gitIgnoreFilter = ignore.default().add(content);
      console.log('.gitignore file loaded and parsed.');
    } catch (error: any) {
      if (error.code !== 'ENOENT') { console.warn('Error reading .gitignore:', error); }
      else { console.log('.gitignore file not found, skipping.'); }
      this.gitIgnoreFilter = null; // Ensure it's null if loading fails
    }
  }

  /**
   * Indexes or re-indexes a single file. Adds generated chunk IDs to tracking set if during initial scan.
   * Implements incremental update check based on modification time.
   */
  private async indexSingleFile(filePath: string, isInitialScan = false): Promise<void> {
     if (!this.isInitialized || !this.indexManager || !this.embeddingFn) {
         console.error('Cannot index file, service not initialized.');
         return;
     }

    const relativePath = path.relative(this.workspaceRoot, filePath);
    // Ignore check is now handled by chokidar

    try {
        const stats = await fs.stat(filePath);
        const currentMtime = stats.mtimeMs;

        // --- Incremental Check ---
        let existingMtime: number | undefined | null = null;
        let existingChunkIds: string[] = [];
        // Only perform DB check if we are in initial scan phase
        if (isInitialScan && this.processedChunkIdsDuringScan) { // Check processedChunkIdsDuringScan is not null
            const existingMetadataMap = await this.indexManager.getChunksMetadataByFilePath(relativePath);
            if (existingMetadataMap && existingMetadataMap.size > 0) {
                const firstEntry = existingMetadataMap.values().next().value;
                existingMtime = firstEntry?.fileMtime as number | undefined | null;
                existingChunkIds = Array.from(existingMetadataMap.keys());
            }

            // If file hasn't changed, skip processing but track existing IDs
            if (existingMtime && currentMtime <= existingMtime) {
                // console.log(`  Skipping unchanged file: ${relativePath}`);
                if (this.processedChunkIdsDuringScan) { // Add null check again for safety
                    for (const id of existingChunkIds) {
                        this.processedChunkIdsDuringScan.add(id);
                    }
                }
                return; // Skip the rest of the function
            }
        }
        // --- End Incremental Check ---

        const content = await fs.readFile(filePath, 'utf-8');
        const doc: Document = { id: relativePath, content: content, metadata: { filePath: relativePath, fileMtime: currentMtime } };
        const language = detectLanguage(relativePath);
        const chunks = await chunkCodeAst(doc.content, language, this.config.chunkingOptions, doc.metadata);

        if (chunks.length === 0) {
            // Only delete if it's a later change event
            if (!isInitialScan && this.initialScanComplete) {
                 await this.deleteFileIndex(filePath);
            }
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
                continue;
            }

            if (vectors.length !== chunkBatch.length) {
                console.error(`Mismatch in embedding batch for ${relativePath}. Skipping.`);
                continue;
            }

            const indexedItems: IndexedItem[] = chunkBatch.map((chunk, index) => {
                const chunkId = `${relativePath}::${chunk.metadata?.chunkIndex ?? (j + index)}`;
                // If during initial scan, add ID to the tracking set
                if (isInitialScan && this.processedChunkIdsDuringScan) {
                    this.processedChunkIdsDuringScan.add(chunkId);
                }
                const finalMetadata = { ...chunk.metadata, fileMtime: currentMtime };
                return { ...chunk, metadata: finalMetadata, id: chunkId, vector: vectors[index] };
            });

            try {
                await this.indexManager.upsertItems(indexedItems);
            } catch (upsertError) {
                console.error(`Error upserting chunk batch for ${relativePath}:`, upsertError);
            }
        }

    } catch (error: unknown) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
            console.log(`File ${relativePath} not found during indexing (likely deleted).`);
            if (!isInitialScan && this.initialScanComplete) { this.deleteFileIndex(filePath); }
        } else {
            console.error(`Error indexing file ${relativePath}:`, error instanceof Error ? error.message : error);
        }
    }
  }

  private async deleteFileIndex(filePath: string): Promise<void> {
     if (!this.isInitialized || !this.indexManager) { /* ... */ return; }
     if (!this.initialScanComplete) { return; } // Only delete after initial scan

    const relativePath = path.relative(this.workspaceRoot, filePath);
    console.log(`Deleting index entries for file: ${relativePath}`);
    try {
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
      initialScanComplete: boolean;
      watching: boolean;
      filesInQueue: number;
      processedFiles: number;
      totalFilesInitialScan: number | null;
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
          // it means we are processing the initial batch.
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
          // After initial scan, if queue still has items (e.g., from watch events), show processing changes
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