import type { RagServiceConfig } from './types.js';
import { IndexManager, type VectorDbConfig, VectorDbProvider } from '@sylphlab/tools-rag';
import chokidar from 'chokidar';
import path from 'node:path';
import fs from 'node:fs/promises';
import ignore from 'ignore';
import type { Ignore } from 'ignore';
import { chunkCodeAst, generateEmbeddings, detectLanguage, type Chunk, type IndexedItem, type IEmbeddingFunction, EmbeddingModelProvider, OllamaEmbeddingFunction, MockEmbeddingFunction, HttpEmbeddingFunction } from '@sylphlab/tools-rag';
import { minimatch } from 'minimatch';
import { debounce, type DebouncedFunc } from 'lodash-es'; // Keep debounce for post-scan changes

// Helper type for Document
interface Document {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export class RagIndexService {
  private config: RagServiceConfig;
  private workspaceRoot: string;
  private indexManager: IndexManager | null = null;
  private embeddingFn: IEmbeddingFunction | null = null;
  private watcher: chokidar.FSWatcher | null = null;
  private isInitialized = false;
  private initialScanComplete = false;
  private initialFilesToProcess: string[] = []; // Queue for initial scan files
  private processedChunkIdsDuringScan: Set<string> | null = null;
  private initialDbIds: Set<string> | null = null;
  private gitIgnoreFilter: Ignore | null = null;
  // Debounce only for file changes *after* initial scan
  private debouncedIndexFile: DebouncedFunc<(filePath: string) => Promise<void>>;
  private isProcessingInitialQueue = false; // Flag for queue processing

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
    if (this.isInitialized) {
      console.warn('RagIndexService already initialized.');
      return;
    }
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
    this.initialFilesToProcess = []; // Reset queue
    this.processedChunkIdsDuringScan = new Set<string>(); // Reset processed IDs
    this.isProcessingInitialQueue = false; // Reset flag

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
      ignored: ignoredPaths, // Basic filtering by chokidar
      persistent: true,
      ignoreInitial: false, // Process initial 'add' events
      awaitWriteFinish: {
        stabilityThreshold: this.config.debounceDelay || 2000,
        pollInterval: 100
      }
    });

    this.watcher
      .on('add', (filePath: string) => {
          // During initial scan phase, queue files if not ignored
          if (!this.initialScanComplete) {
              const relativePath = path.relative(this.workspaceRoot, filePath);
              if (!this.shouldIgnore(relativePath)) {
                  this.initialFilesToProcess.push(filePath);
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
          console.log(`Chokidar initial scan reported complete. Found ${this.initialFilesToProcess.length} files to process.`);
          // Start processing the collected files
          await this.processInitialScanQueue(); // Wait for queue to finish
          console.log('Initial processing queue finished.');

          this.initialScanComplete = true;

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
          this.processedChunkIdsDuringScan = null;
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

  private handleFileEvent(eventType: 'add' | 'change' | 'unlink', filePath: string): void {
    // This handler is now only for events *after* initial scan is complete
    if (!this.initialScanComplete) return;

    const relativePath = path.relative(this.workspaceRoot, filePath);
    if (this.shouldIgnore(relativePath)) { return; }

    console.log(`File event: ${eventType} - ${relativePath}`);

    switch (eventType) {
      case 'add':
      case 'change':
        this.debouncedIndexFile(filePath); // Use debounce for subsequent changes
        break;
      case 'unlink':
        this.deleteFileIndex(filePath); // Handle delete immediately
        break;
    }
  }

  /** Process files added during the initial scan sequentially */
  private async processInitialScanQueue(): Promise<void> {
      if (this.isProcessingInitialQueue) return;
      this.isProcessingInitialQueue = true;
      console.log(`Processing initial scan queue (${this.initialFilesToProcess.length} items)...`);

      const totalFiles = this.initialFilesToProcess.length;
      for(let i = 0; i < totalFiles; i++) {
          const filePath = this.initialFilesToProcess[i];
          // Log progress before processing each file
          console.log(`[Initial Scan ${i + 1}/${totalFiles}] Processing ${path.relative(this.workspaceRoot, filePath)}`);
          // Directly call indexSingleFile, passing true for isInitialScan
          await this.indexSingleFile(filePath, true);
      }

      console.log("Finished processing initial scan queue.");
      this.isProcessingInitialQueue = false;
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
      if (error.code !== 'ENOENT') { console.warn('Error reading .gitignore:', error); } // Removed backticks
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
    // No need to check ignore here, handled by caller

    // console.log(`Indexing file: ${relativePath} ${isInitialScan ? '(Initial Scan)' : ''}`); // Reduce log noise

    try {
        const content = await fs.readFile(filePath, 'utf-8');
        const doc: Document = { id: relativePath, content: content, metadata: { filePath: relativePath } };
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
            // const batchLogPrefix = `...`; // Reduce log noise

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
                return { ...chunk, id: chunkId, vector: vectors[index] };
            });

            try {
                await this.indexManager.upsertItems(indexedItems);
            } catch (upsertError) {
                console.error(`Error upserting chunk batch for ${relativePath}:`, upsertError);
            }
        }
        // console.log(`Finished indexing ${relativePath}. Upserted ... chunks.`); // Reduce log noise

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

  public getServiceStatus(): { initialized: boolean; initialScanComplete: boolean; watching: boolean } {
      return {
          initialized: this.isInitialized,
          initialScanComplete: this.initialScanComplete,
          watching: !!this.watcher,
      };
  }
}