# RAG System Refactoring Plan (2025-04-26)

**Core Goal:** Enhance Indexing Performance and Query Result Performance.

**Priority 1: Refactor Sync Mechanism (`RagIndexService`)**

*   **Objective:** Implement a more robust and efficient synchronization process upon service start/restart, accurately handling offline changes (add, modify, delete).
*   **Approach:** Optimized Producer-Consumer with DB State Comparison.
*   **Detailed Steps:**
    1.  **DB State Query:** On service start, query `IndexManager` to get the last known indexed state for all files (`dbFileStates: Map<filePath, lastMtime>`). This requires implementing a suitable query in `IndexManager` (e.g., fetching all chunk metadata and processing in memory).
    2.  **Chokidar Initial Scan:** Start `chokidar` (`ignoreInitial: false`) to get the current list of files (`initialFilesFound`) after applying ignore rules.
    3.  **Difference Calculation (`ready` event):**
        *   Compare `initialFilesFound` (getting current `mtime` from FS) with `dbFileStates`.
        *   Identify files to be added/updated (`filesToIndex`: new files or `currentMtime > lastMtime`).
        *   Identify files to be deleted (`filesToDelete`: in `dbFileStates` but not `initialFilesFound`).
    4.  **Queue Processing:** Add identified add/update/delete tasks to the `processingQueue`.
    5.  **Consumer Execution:** Start the `processQueueLoop` to handle the tasks (calling `indexSingleFile` or `deleteFileIndex`).
    6.  **Real-time Watch:** Only after the initial sync queue is fully processed, allow `chokidar` to handle subsequent real-time events.
    7.  **Modify `indexSingleFile`:** Ensure `fileMtime` is consistently stored in chunk metadata during `upsertItems`.
    8.  **Remove Old Logic:** Remove the previous `mtime` check within `indexSingleFile` (as it's now handled at startup) and the `getAllIds`-based stale cleanup in `startWatching`.

**Priority 2: Optimize Chunking Strategy (`chunkCodeAst`)**

*   **Objective:** Improve semantic integrity and quality of chunks, reduce reliance on simple text splitting fallback.
*   **Approach:** Enhance Lezer AST traversal and fallback logic.
*   **Detailed Steps:**
    1.  **Thorough Recursion:** Modify `recursiveLezerChunker` to always traverse all child nodes.
    2.  **Boundary Prioritization:** Give priority to creating chunks from nodes matching `CHUNK_BOUNDARY_TYPES` if they fit within `maxChunkSize`.
    3.  **Smart Fallback:** Replace direct `splitTextWithOverlap` fallback for oversized nodes/leaves. Implement sequential fallback attempts:
        *   Split by sentence/paragraph (for natural language parts like comments, Markdown paragraphs).
        *   Split by blank lines/indentation changes (for code).
        *   Use `splitTextWithOverlap` only as the last resort.
    4.  **Markdown AST:** Remove the current Markdown fallback. Utilize `@lezer/markdown` parser. Define appropriate `CHUNK_BOUNDARY_TYPES` for Markdown (Headings, Paragraphs, Code, Lists, etc.). Apply recursion and smart fallback to Markdown nodes (especially Paragraphs).
    5.  **(Optional) Small Node Merging:** Consider logic to merge adjacent small, non-boundary sibling nodes.
    6.  **(Optional) Richer Metadata:** Extract and add function/class names or heading levels to chunk metadata.

**Implementation Note:** All changes will be implemented first, followed by comprehensive testing.