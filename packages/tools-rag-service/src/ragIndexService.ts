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
  private gitIgnoreFilter: Ignore | null = null;
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
    // Load .gitignore
    if (this.config.respectGitignore) { await this.loadGitIgnore(); }
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

    // Prepare basic ignore patterns for chokidar
    const ignoredPaths: string[] = [];
    if (this.config.excludePatterns) { ignoredPaths.push(...this.config.excludePatterns); }
    ignoredPaths.push('**/node_modules/**', '**/.git/**', '**/dist/**', '**/.*', '.*');

    this.watcher = chokidar.watch(this.workspaceRoot, {
      ignored: ignoredPaths,
      persistent: true,
      ignoreInitial: false, // Process initial 'add' events
      awaitWriteFinish: {
        stabilityThreshold: this.config.debounceDelay || 2000,
        pollInterval: 100
      }
    });

    this.watcher
      .on('add', (filePath: string) => {
          // During initial scan phase, collect files if not ignored
          if (!this.initialScanComplete) {
              const relativePath = path.relative(this.workspaceRoot, filePath);
              if (!this.shouldIgnore(relativePath)) {
                  initialFilesFound.push(filePath); // Add to temp list
              }
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
    const relativePath = path.relative(this.workspaceRoot, filePath);
    if (this.shouldIgnore(relativePath)) { return; }

    // console.log(`File event: ${eventType} - ${relativePath}`); // Reduce noise

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
              this.processedFilesCount++;
              const total = this.totalFilesFoundDuringScan ?? '?'; // Use '?' if total not yet known
              const relativePath = path.relative(this.workspaceRoot, filePath);
              console.log(`[${this.processedFilesCount}/${total}] Processing ${relativePath}...`);
              await this.indexSingleFile(filePath, isInitial);
          }
      }

      // console.log("Finished processing queue loop.");
      this.isProcessingQueue = false;
  }


   private shouldIgnore(relativePath: string): boolean { /* ... (same as before) ... */
    const cleanRelativePath = relativePath.replace(/\\/g, '/');
    if (this.config.excludePatterns?.some((pattern: string) => minimatch(cleanRelativePath, pattern, { dot: true }))) { return true; }
    if (this.config.respectGitignore && this.gitIgnoreFilter?.ignores(cleanRelativePath)) { return true; }
    if (cleanRelativePath.startsWith('.') || cleanRelativePath.includes('/.')) { return true; }
    if (cleanRelativePath.includes('/node_modules/') || cleanRelativePath.startsWith('node_modules/')) { return true; }
    if (cleanRelativePath.includes('/.git/') || cleanRelativePath.startsWith('.git/')) { return true; }
    if (cleanRelativePath.includes('/dist/') || cleanRelativePath.startsWith('dist/')) { return true; }
    if (this.config.includePatterns && this.config.includePatterns.length > 0) {
        if (!this.config.includePatterns.some((pattern: string) => minimatch(cleanRelativePath, pattern, { dot: true }))) {
            return true;
        }
    }
    return false;
  }

  private async loadGitIgnore(): Promise<void> { /* ... (same as before) ... */
    const gitignorePath = path.join(this.workspaceRoot, '.gitignore');
    try {
      const content = await fs.readFile(gitignorePath, 'utf-8');
      this.gitIgnoreFilter = ignore.default().add(content);
      console.log('.gitignore file loaded and parsed.');
    } catch (error: any) {
      if (error.code !== 'ENOENT') { console.warn('Error reading .gitignore:', error); }
      else { console.log('.gitignore file not found, skipping.'); }
      this.gitIgnoreFilter = null;
    }
  }

  /**
   * Indexes or re-indexes a single file. Adds generated chunk IDs to tracking set if during initial scan.
   */
  private async indexSingleFile(filePath: string, isInitialScan = false): Promise<void> {
     if (!this.isInitialized || !this.indexManager || !this.embeddingFn) { /* ... */ return; }

    const relativePath = path.relative(this.workspaceRoot, filePath);
    // Ignore check is done by the caller (handleFileEvent)

    // console.log(`Indexing file: ${relativePath} ${isInitialScan ? '(Initial Scan)' : ''}`); // Reduce log noise

    try {
        const stats = await fs.stat(filePath); // Get stats first
        const content = await fs.readFile(filePath, 'utf-8');
        // Include mtimeMs in the base metadata for the document/chunks
        const doc: Document = { id: relativePath, content: content, metadata: { filePath: relativePath, fileMtime: stats.mtimeMs } };
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
            // const batchLogPrefix = `...`;

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
                // Ensure fileMtime is included in the final metadata for upsert
                const finalMetadata = { ...chunk.metadata, fileMtime: stats.mtimeMs };
                return { ...chunk, metadata: finalMetadata, id: chunkId, vector: vectors[index] };
            });

            try {
                await this.indexManager.upsertItems(indexedItems);
            } catch (upsertError) {
                console.error(`Error upserting chunk batch for ${relativePath}:`, upsertError);
            }
        }
        // console.log(`Finished indexing ${relativePath}.`); // Reduce log noise

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
     // Only allow deletion after initial scan is complete
     if (!this.initialScanComplete) { return; }

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

  /** Returns the current operational status and progress of the service. */
  public getServiceStatus(): {
      state: 'Initializing' | 'Scanning' | 'Processing Initial Queue' | 'Watching' | 'Idle' | 'Stopping';
      initialized: boolean;
      initialScanComplete: boolean;
      watching: boolean;
      filesInQueue: number;
      processedFiles: number;
      totalFilesInitialScan: number | null;
  } {
      let state: 'Initializing' | 'Scanning' | 'Processing Initial Queue' | 'Watching' | 'Idle' | 'Stopping' = 'Idle';
      if (!this.isInitialized) {
          state = 'Initializing';
      } else if (!this.initialScanComplete) {
          if (this.isProcessingQueue) {
              state = 'Processing Initial Queue';
          } else {
              // If watcher exists but scan isn't complete and queue isn't processing, it's likely scanning
              state = this.watcher ? 'Scanning' : 'Initializing'; // Or could be stuck?
          }
      } else if (this.watcher) {
          state = this.isProcessingQueue ? 'Processing Initial Queue' : 'Watching'; // Still processing if queue has items after scan
      } else if (this.isProcessingQueue) {
          // Should not happen if watcher stopped correctly, but handle state
          state = 'Processing Initial Queue';
      }
      // Note: 'Stopping' state isn't explicitly tracked yet

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