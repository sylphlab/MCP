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
      // Load all documents first
      let documents = await loadDocuments(this.workspaceRoot);
      console.log(`Loaded ${documents.length} raw documents.`);

      // Filter documents based on ignore rules AFTER loading
      documents = documents.filter(doc => !this.shouldIgnore(doc.id)); // Assuming doc.id is relative path

      console.log(`Filtered down to ${documents.length} documents.`);
      if (documents.length === 0) {
        console.log('No documents found to index after filtering.');
        // Optionally clear the index if no documents are found?
        // await this.indexManager.deleteAllItems(); // Be careful with this
        return;
      }

      const allChunks: Chunk[] = [];
      for (const doc of documents) {
        const language = detectLanguage((doc.metadata?.filePath as string | undefined) || doc.id);
        // Pass chunking options from config
        const chunks = await chunkCodeAst(doc.content, language, this.config.chunkingOptions, doc.metadata);
        allChunks.push(...chunks);
      }
      console.log(`Generated ${allChunks.length} chunks.`);

      if (allChunks.length === 0) {
        console.log('No chunks generated.');
        // Optionally clear the index
        // await this.indexManager.deleteAllItems();
        return;
      }

      // Batch embedding generation
      const vectors = await this.embeddingFn.generate(allChunks.map((c) => c.content));
      if (vectors.length !== allChunks.length) {
        throw new Error(`Mismatch between chunk count (${allChunks.length}) and vector count (${vectors.length})`);
      }

      const indexedItems: IndexedItem[] = allChunks.map((chunk, index) => ({
        ...chunk,
        // Generate a more robust ID, perhaps hash of content + path?
        id: `${chunk.metadata?.filePath || chunk.id}::${chunk.metadata?.chunkIndex ?? index}`,
        vector: vectors[index],
      }));

      console.log(`Upserting ${indexedItems.length} items...`);
      await this.indexManager.upsertItems(indexedItems);

      // Delete stale items
      const currentIds = new Set(indexedItems.map((item) => item.id));
      const existingIds = await this.indexManager.getAllIds();
      const staleIds = existingIds.filter((id: string) => !currentIds.has(id)); // Add type for id

      if (staleIds.length > 0) {
        console.log(`Deleting ${staleIds.length} stale items...`);
        await this.indexManager.deleteItems(staleIds);
      } else {
        console.log('No stale items found.');
      }

      console.log('Workspace index synchronization completed.');
    } catch (error) {
      console.error('Error during workspace index synchronization:', error);
      // Decide if error should be re-thrown
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

    // Use const as it's not reassigned, only pushed to
    const ignoredPaths: string[] = [];

    // Add patterns from config.excludePatterns
    if (this.config.excludePatterns) {
        ignoredPaths.push(...this.config.excludePatterns);
    }

    // Note: Chokidar has built-in .gitignore handling if `ignored` is not provided.
    // However, since we combine with excludePatterns and DB path, we manage ignores explicitly.
    // We will rely on the `shouldIgnore` method for fine-grained filtering after an event is received,
    // but we can pass common/config excludes to chokidar for initial filtering.

    // Ensure the vector DB path is ignored if it's within the workspace and uses a local path
    // Check if vectorDbConfig exists before accessing provider
    if (this.config.vectorDb && this.config.vectorDb.provider === VectorDbProvider.ChromaDB && this.config.vectorDb.path) {
        const dbPath = path.resolve(this.workspaceRoot, this.config.vectorDb.path);
        if (dbPath.startsWith(this.workspaceRoot)) {
            const relativeDbPath = path.relative(this.workspaceRoot, dbPath);
            // Add pattern to ignore the DB directory
            ignoredPaths.push(`${relativeDbPath}/**`);
            console.log(`Ignoring vector DB path: ${relativeDbPath}`);
        }
    }
     // Add common ignores like node_modules and dotfiles/dirs
     // These are often in .gitignore but adding them here provides a fallback.
    ignoredPaths.push('**/node_modules/**', '**/.git/**', '**/.*'); // Ignore .git and dotfiles/dirs


    this.watcher = chokidar.watch(this.workspaceRoot, {
      ignored: ignoredPaths, // Pass combined ignore patterns
      persistent: true,
      ignoreInitial: true, // Don't trigger 'add' events on initial scan
      awaitWriteFinish: { // Helps avoid triggering on incomplete writes
        stabilityThreshold: this.config.debounceDelay || 2000,
        pollInterval: 100
      }
    });

    this.watcher
      .on('add', (filePath: string) => this.handleFileEvent('add', filePath)) // Add type for filePath
      .on('change', (filePath: string) => this.handleFileEvent('change', filePath)) // Add type for filePath
      .on('unlink', (filePath: string) => this.handleFileEvent('unlink', filePath)) // Add type for filePath
      .on('error', (error: Error) => console.error(`Watcher error: ${error}`)) // Add type for error
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
    if (this.isSyncing) return; // Don't handle events during full sync

    const relativePath = path.relative(this.workspaceRoot, filePath);
    // console.log(`File event: ${eventType} - ${relativePath}`); // Debug logging

    if (this.shouldIgnore(relativePath)) {
        // console.log(`Ignoring event for path: ${relativePath}`); // Debug logging
        return;
    }


    switch (eventType) {
      case 'add':
      case 'change':
        // Debounce indexing for add/change events
        this.debouncedIndexFile(filePath);
        break;
      case 'unlink':
        // Handle deletion immediately (or debounce if preferred)
        this.deleteFileIndex(filePath);
        break;
    }
  }

   /**
   * Checks if a given relative path should be ignored based on config and .gitignore.
   */
  private shouldIgnore(relativePath: string): boolean {
    // Ensure relativePath uses forward slashes for consistency with ignore/minimatch
    const cleanRelativePath = relativePath.replace(/\\/g, '/');

    // --- Exclusion rules ---
    // 1. Check explicit exclude patterns from config first
    if (this.config.excludePatterns?.some((pattern: string) => minimatch(cleanRelativePath, pattern, { dot: true }))) {
        // console.log(`Ignoring ${cleanRelativePath} due to excludePatterns`);
        return true;
    }

    // 2. Check .gitignore if loaded and configured
    if (this.config.respectGitignore && this.gitIgnoreFilter?.ignores(cleanRelativePath)) {
      // console.log(`Ignoring ${cleanRelativePath} due to .gitignore`);
      return true;
    }

    // 3. Check common default ignores (dotfiles/dirs, node_modules, .git) - apply AFTER specific excludes/gitignore
     if (cleanRelativePath.startsWith('.') || cleanRelativePath.includes('/.')) {
        // console.log(`Ignoring ${cleanRelativePath} due to dotfile/dir pattern`);
        return true;
     }
     if (cleanRelativePath.includes('node_modules') || cleanRelativePath.includes('.git')) {
        // console.log(`Ignoring ${cleanRelativePath} due to node_modules or .git`);
        return true;
     }

    // --- Inclusion rule ---
    // 4. If includePatterns are defined, the path MUST match at least one
    if (this.config.includePatterns && this.config.includePatterns.length > 0) {
        if (!this.config.includePatterns.some((pattern: string) => minimatch(cleanRelativePath, pattern, { dot: true }))) {
            // console.log(`Ignoring ${cleanRelativePath} because it doesn't match includePatterns`);
            return true; // Ignore if includePatterns exist but path doesn't match any
        }
    }

    // If no exclusion rule matched, and inclusion rules (if any) were satisfied, don't ignore
    return false;
  }

  /**
   * Loads and parses the .gitignore file from the workspace root.
   */
  private async loadGitIgnore(): Promise<void> {
    const gitignorePath = path.join(this.workspaceRoot, '.gitignore');
    try {
      const content = await fs.readFile(gitignorePath, 'utf-8');
      this.gitIgnoreFilter = ignore.default().add(content); // Use ignore.default()
      console.log('.gitignore file loaded and parsed.');
    } catch (error: any) {
      // ENOENT means file doesn't exist, which is fine
      if (error.code !== 'ENOENT') {
        console.warn(`Error reading or parsing .gitignore file at ${gitignorePath}:`, error);
      } else {
        console.log('.gitignore file not found, skipping.');
      }
      this.gitIgnoreFilter = null; // Ensure it's null if loading fails or file not found
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
    if (this.isSyncing) return; // Should ideally be prevented by debouncing, but double check

    const relativePath = path.relative(this.workspaceRoot, filePath);
    console.log(`Indexing file: ${relativePath}`);

    try {
        // 1. Read file content
        const content = await fs.readFile(filePath, 'utf-8');

        // 2. Create a Document object
        const doc: Document = {
            id: relativePath, // Use relative path as ID
            content: content,
            metadata: { filePath: relativePath }
        };

        // 3. Detect language, chunk, embed, create IndexedItems
        const language = detectLanguage(relativePath);
        // Pass chunking options from config
        const chunks = await chunkCodeAst(doc.content, language, this.config.chunkingOptions, doc.metadata);
        if (chunks.length === 0) {
            console.log(`No chunks generated for ${relativePath}. Deleting existing if any.`);
            // If a file changes to have no chunks, delete its old chunks
            await this.deleteFileIndex(filePath);
            return;
        }

        const vectors = await this.embeddingFn.generate(chunks.map((c: Chunk) => c.content)); // Add type for c
         if (vectors.length !== chunks.length) { // Compare with chunks for this file
            throw new Error(`Mismatch between chunk count (${chunks.length}) and vector count (${vectors.length})`);
        }

        const indexedItems: IndexedItem[] = chunks.map((chunk: Chunk, index: number) => ({ // Add types for chunk and index
            ...chunk,
            id: `${relativePath}::${chunk.metadata?.chunkIndex ?? index}`,
            vector: vectors[index],
        }));

        // 4. Upsert items (this will overwrite existing chunks for the same file)
        await this.indexManager.upsertItems(indexedItems);
        console.log(`Upserted ${indexedItems.length} chunks for ${relativePath}`);

    } catch (error) {
        // Handle file read errors (e.g., file deleted between event and read)
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
            console.log(`File ${relativePath} not found during indexing (likely deleted). Attempting cleanup.`);
            await this.deleteFileIndex(filePath); // Clean up index if file is gone
        } else {
            console.error(`Error indexing file ${relativePath}:`, error);
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
        // Use the new deleteWhere method in IndexManager
        // Note: Pinecone implementation currently logs a warning as direct filter deletion is complex.
        await this.indexManager.deleteWhere({ filePath: relativePath });
        console.log(`Attempted deletion of chunks for file: ${relativePath}`);

    } catch (error) {
         console.error(`Error deleting index entries for ${relativePath}:`, error);
    }
  }

  // --- Public methods to potentially proxy core RAG operations ---
  // (Keep commented out as tools will likely use IndexManager directly via config)

}

// Helper type (might move to types.ts later)
interface Document {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
}