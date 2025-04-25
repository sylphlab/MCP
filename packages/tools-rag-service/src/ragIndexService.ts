import type { RagServiceConfig } from './types.js'; // Import from local types file
import { IndexManager, type EmbeddingModelConfig, type VectorDbConfig, VectorDbProvider } from '@sylphlab/tools-rag'; // Import core components + VectorDbProvider
import chokidar from 'chokidar';
import path from 'node:path';
import fs from 'node:fs/promises';
import ignore from 'ignore'; // Try default import style
import type { Ignore } from 'ignore'; // Import type separately
// Import other necessary functions from tools-rag (e.g., loadDocuments, chunkCodeAst, generateEmbeddings, detectLanguage)
import { loadDocuments, chunkCodeAst, generateEmbeddings, detectLanguage, type Chunk, type IndexedItem, type IEmbeddingFunction, EmbeddingModelProvider, OllamaEmbeddingFunction, MockEmbeddingFunction, HttpEmbeddingFunction } from '@sylphlab/tools-rag';
import { minimatch } from 'minimatch'; // For glob pattern matching
import { debounce } from 'lodash-es'; // Using lodash for debounce

// Define a type for the file event handler context if needed
// interface FileEventContext { ... }

export class RagIndexService {
  private config: RagServiceConfig;
  private workspaceRoot: string;
  private indexManager: IndexManager | null = null;
  private embeddingFn: IEmbeddingFunction | null = null;
  private watcher: chokidar.FSWatcher | null = null;
  private isInitialized = false;
  private isSyncing = false;
  private gitIgnoreFilter: Ignore | null = null; // Property to hold the ignore filter
  private debouncedIndexFile: (filePath: string) => void;

  constructor(config: RagServiceConfig, workspaceRoot: string) {
    this.config = config; // Store the full service config
    this.workspaceRoot = workspaceRoot;

    // Initialize debounced function for handling file changes
    this.debouncedIndexFile = debounce(
      this.indexSingleFile.bind(this),
      this.config.debounceDelay || 2000 // Default debounce delay 2 seconds
    );

    console.log('RagIndexService created with config:', this.config);
  }

  /**
   * Initializes the IndexManager and EmbeddingFunction based on config.
   * Must be called before other methods.
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('RagIndexService already initialized.');
      return;
    }

    console.log('Initializing RagIndexService...');

    // 1. Initialize Embedding Function
    const embeddingConfig = this.config.embedding;
    if (embeddingConfig.provider === EmbeddingModelProvider.Ollama) {
      this.embeddingFn = new OllamaEmbeddingFunction(embeddingConfig.modelName, embeddingConfig.baseURL);
    } else if (embeddingConfig.provider === EmbeddingModelProvider.Http) {
        this.embeddingFn = new HttpEmbeddingFunction(embeddingConfig.url, embeddingConfig.headers, embeddingConfig.batchSize);
    } else { // Default to Mock or handle other providers
      this.embeddingFn = new MockEmbeddingFunction(embeddingConfig.mockDimension);
      console.warn(`Using MockEmbeddingFunction (dim: ${embeddingConfig.mockDimension}) as provider is ${embeddingConfig.provider}`);
    }

    // 2. Initialize IndexManager
    if (!this.embeddingFn) {
      // This should ideally not happen if initialization logic is correct
      throw new Error('Embedding function failed to initialize.');
    }
    this.indexManager = await IndexManager.create(this.config.vectorDb, this.embeddingFn);

    // 3. Load .gitignore if needed
    if (this.config.respectGitignore) {
      await this.loadGitIgnore();
    }

    this.isInitialized = true;
    console.log('RagIndexService initialized successfully.');
  }

  /**
   * Performs a full synchronization of the workspace index.
   * Loads documents, chunks, embeds, upserts, and deletes stale entries.
   */
  async syncWorkspaceIndex(): Promise<void> {
    if (!this.isInitialized || !this.indexManager || !this.embeddingFn) {
      throw new Error('RagIndexService must be initialized before syncing.');
    }
    if (this.isSyncing) {
      console.warn('Sync already in progress. Skipping.');
      return;
    }

    this.isSyncing = true;
    console.log('Starting workspace index synchronization...');

    try {
      // Load documents using the updated loader with filtering options
      const documents = await loadDocuments(
          this.workspaceRoot,
          this.config.includePatterns,
          this.config.excludePatterns,
          this.config.respectGitignore
      );
      console.log(`Loaded ${documents.length} documents after filtering.`);
      if (documents.length === 0) {
        console.log('No documents found to index after filtering.');
        // If no documents are found, ensure the index is empty by deleting all existing items
        const existingIds = await this.indexManager.getAllIds();
        if (existingIds.length > 0) {
            console.log(`Deleting all ${existingIds.length} existing items as no documents were found.`);
            await this.indexManager.deleteItems(existingIds);
        }
        return; // Exit early
      }

      const allGeneratedChunkIds = new Set<string>();
      // Determine batch size from embedding config or use a default
      const embeddingBatchSize = (this.config.embedding as any)?.batchSize || 50;
      let totalChunksGenerated = 0;
      let totalItemsUpserted = 0;

      console.log(`Processing ${documents.length} documents in batches...`);

      for (let i = 0; i < documents.length; i++) {
          const doc = documents[i];
          const language = detectLanguage((doc.metadata?.filePath as string | undefined) || doc.id);
          console.log(`[${i+1}/${documents.length}] Chunking ${doc.id}...`);

          // Chunk document
          const chunks = await chunkCodeAst(doc.content, language, this.config.chunkingOptions, doc.metadata);
          totalChunksGenerated += chunks.length;

          if (chunks.length === 0) {
              console.log(`  No chunks generated for ${doc.id}.`);
              continue; // Skip to next document
          }
          console.log(`  Generated ${chunks.length} chunks for ${doc.id}.`);

          // Process chunks in batches for embedding and upserting
          for (let j = 0; j < chunks.length; j += embeddingBatchSize) {
              const chunkBatch = chunks.slice(j, j + embeddingBatchSize);
              const batchLogPrefix = `  [${doc.id} Batch ${Math.floor(j / embeddingBatchSize) + 1}/${Math.ceil(chunks.length / embeddingBatchSize)}]`;
              console.log(`${batchLogPrefix} Processing ${chunkBatch.length} chunks...`);

              // Generate embeddings
              console.log(`${batchLogPrefix} Generating embeddings...`);
              let vectors: number[][];
              try {
                  vectors = await this.embeddingFn.generate(chunkBatch.map((c) => c.content));
                  console.log(`${batchLogPrefix} Embeddings generated successfully.`);
              } catch (embeddingError) {
                  console.error(`${batchLogPrefix} Error generating embeddings:`, embeddingError);
                  continue; // Skip this batch if embedding fails
              }

              // Check for mismatch (should ideally not happen if generateEmbeddings is correct)
              if (vectors.length !== chunkBatch.length) {
                  console.error(`${batchLogPrefix} Mismatch in embedding batch. Expected ${chunkBatch.length}, got ${vectors.length}. Skipping batch.`);
                  continue; // Skip this batch
              }

              // Prepare indexed items
              const indexedItems: IndexedItem[] = chunkBatch.map((chunk, index) => {
                  // Ensure unique ID generation logic is consistent
                  const chunkId = `${chunk.metadata?.filePath || chunk.id}::${chunk.metadata?.chunkIndex ?? (j + index)}`;
                  allGeneratedChunkIds.add(chunkId); // Track all generated IDs for this sync
                  return {
                      ...chunk,
                      id: chunkId,
                      vector: vectors[index],
                  };
              });

              // Upsert batch
              console.log(`${batchLogPrefix} Upserting ${indexedItems.length} items...`);
              try {
                  await this.indexManager.upsertItems(indexedItems);
                  totalItemsUpserted += indexedItems.length;
                  console.log(`${batchLogPrefix} Upserted batch successfully.`);
              } catch (upsertError) {
                  console.error(`${batchLogPrefix} Error upserting chunk batch:`, upsertError);
                  // Decide whether to continue with next batch or stop/re-throw
              }
          } // End chunk batch loop
      } // End document loop

      console.log(`Total chunks generated: ${totalChunksGenerated}`);
      console.log(`Total items upserted: ${totalItemsUpserted}`);

      // Delete stale items (compare all generated IDs with existing IDs)
      console.log("Checking for stale items...");
      const existingIds = await this.indexManager.getAllIds();
      const staleIds = existingIds.filter((id: string) => !allGeneratedChunkIds.has(id));

      if (staleIds.length > 0) {
        console.log(`Deleting ${staleIds.length} stale items...`);
        await this.indexManager.deleteItems(staleIds);
      } else {
        console.log('No stale items found.');
      }

      console.log('Workspace index synchronization completed.');
    } catch (error: unknown) { // Catch errors during the overall sync process
      console.error('Error during workspace index synchronization:', error instanceof Error ? error.message : error);
    } finally {
      this.isSyncing = false;
    }
  }


  /**
   * Starts watching the workspace for file changes if autoWatchEnabled is true.
   */
  startWatching(): void {
    if (!this.isInitialized) {
      console.warn('Cannot start watching, service not initialized.');
      return;
    }
    if (!this.config.autoWatchEnabled) {
      console.log('Auto-watching is disabled in configuration.');
      return;
    }
    if (this.watcher) {
      console.warn('Watcher already running.');
      return;
    }

    console.log('Starting file watcher...');

    const ignoredPaths: string[] = [];
    if (this.config.excludePatterns) {
        ignoredPaths.push(...this.config.excludePatterns);
    }
    if (this.config.vectorDb && this.config.vectorDb.provider === VectorDbProvider.ChromaDB && this.config.vectorDb.path) {
        const dbPath = path.resolve(this.workspaceRoot, this.config.vectorDb.path);
        if (dbPath.startsWith(this.workspaceRoot)) {
            const relativeDbPath = path.relative(this.workspaceRoot, dbPath);
            ignoredPaths.push(`${relativeDbPath}/**`);
            console.log(`Ignoring vector DB path: ${relativeDbPath}`);
        }
    }
    ignoredPaths.push('**/node_modules/**', '**/.git/**', '**/.*');

    this.watcher = chokidar.watch(this.workspaceRoot, {
      ignored: ignoredPaths,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: this.config.debounceDelay || 2000,
        pollInterval: 100
      }
    });

    this.watcher
      .on('add', (filePath: string) => this.handleFileEvent('add', filePath))
      .on('change', (filePath: string) => this.handleFileEvent('change', filePath))
      .on('unlink', (filePath: string) => this.handleFileEvent('unlink', filePath))
      .on('error', (error: Error) => console.error(`Watcher error: ${error}`))
      .on('ready', () => console.log('File watcher ready.'));
  }

  /**
   * Stops the file watcher.
   */
  async stopWatching(): Promise<void> {
    if (this.watcher) {
      console.log('Stopping file watcher...');
      await this.watcher.close();
      this.watcher = null;
      console.log('File watcher stopped.');
    }
  }

  /**
   * Handles file events from the watcher.
   */
  private handleFileEvent(eventType: 'add' | 'change' | 'unlink', filePath: string): void {
    if (this.isSyncing) return;

    const relativePath = path.relative(this.workspaceRoot, filePath);

    if (this.shouldIgnore(relativePath)) {
        return;
    }

    console.log(`File event: ${eventType} - ${relativePath}`); // Log after ignore check

    switch (eventType) {
      case 'add':
      case 'change':
        this.debouncedIndexFile(filePath);
        break;
      case 'unlink':
        this.deleteFileIndex(filePath);
        break;
    }
  }

   /**
   * Checks if a given relative path should be ignored based on config and .gitignore.
   */
  private shouldIgnore(relativePath: string): boolean {
    const cleanRelativePath = relativePath.replace(/\\/g, '/');

    // Exclusion rules
    if (this.config.excludePatterns?.some((pattern: string) => minimatch(cleanRelativePath, pattern, { dot: true }))) { return true; }
    if (this.config.respectGitignore && this.gitIgnoreFilter?.ignores(cleanRelativePath)) { return true; }
    if (cleanRelativePath.startsWith('.') || cleanRelativePath.includes('/.')) { return true; }
    if (cleanRelativePath.includes('node_modules') || cleanRelativePath.includes('.git')) { return true; }

    // Inclusion rule
    if (this.config.includePatterns && this.config.includePatterns.length > 0) {
        if (!this.config.includePatterns.some((pattern: string) => minimatch(cleanRelativePath, pattern, { dot: true }))) {
            return true;
        }
    }
    return false;
  }

  /**
   * Loads and parses the .gitignore file from the workspace root.
   */
  private async loadGitIgnore(): Promise<void> {
    const gitignorePath = path.join(this.workspaceRoot, '.gitignore');
    try {
      const content = await fs.readFile(gitignorePath, 'utf-8');
      this.gitIgnoreFilter = ignore.default().add(content);
      console.log('.gitignore file loaded and parsed.');
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.warn(`Error reading or parsing .gitignore file at ${gitignorePath}:`, error);
      } else {
        console.log('.gitignore file not found, skipping.');
      }
      this.gitIgnoreFilter = null;
    }
  }

  /**
   * Indexes or re-indexes a single file.
   */
  private async indexSingleFile(filePath: string): Promise<void> {
     if (!this.isInitialized || !this.indexManager || !this.embeddingFn) {
      console.error('Cannot index file, service not initialized.');
      return;
    }
    if (this.isSyncing) return;

    const relativePath = path.relative(this.workspaceRoot, filePath);
    console.log(`Indexing file: ${relativePath}`);

    try {
        const content = await fs.readFile(filePath, 'utf-8');
        const doc: Document = { id: relativePath, content: content, metadata: { filePath: relativePath } };
        const language = detectLanguage(relativePath);
        const chunks = await chunkCodeAst(doc.content, language, this.config.chunkingOptions, doc.metadata);

        if (chunks.length === 0) {
            console.log(`No chunks generated for ${relativePath}. Deleting existing if any.`);
            await this.deleteFileIndex(filePath);
            return;
        }

        const vectors = await this.embeddingFn.generate(chunks.map((c: Chunk) => c.content));
         if (vectors.length !== chunks.length) {
            throw new Error(`Mismatch between chunk count (${chunks.length}) and vector count (${vectors.length})`);
        }

        const indexedItems: IndexedItem[] = chunks.map((chunk: Chunk, index: number) => ({
            ...chunk,
            id: `${relativePath}::${chunk.metadata?.chunkIndex ?? index}`,
            vector: vectors[index],
        }));

        await this.indexManager.upsertItems(indexedItems);
        console.log(`Upserted ${indexedItems.length} chunks for ${relativePath}`);

    } catch (error: unknown) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
            console.log(`File ${relativePath} not found during indexing (likely deleted). Attempting cleanup.`);
            this.deleteFileIndex(filePath);
        } else {
            console.error(`Error indexing file ${relativePath}:`, error instanceof Error ? error.message : error);
        }
    }
  }

  /**
   * Deletes all index entries associated with a specific file path.
   */
  private async deleteFileIndex(filePath: string): Promise<void> {
     if (!this.isInitialized || !this.indexManager) {
      console.error('Cannot delete file index, service not initialized.');
      return;
    }
     if (this.isSyncing) return;

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

  /** Returns the current operational status of the service. */
  public getServiceStatus(): { initialized: boolean; syncing: boolean; watching: boolean } {
      return {
          initialized: this.isInitialized,
          syncing: this.isSyncing,
          watching: !!this.watcher,
      };
  }
}

// Helper type
interface Document {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
}