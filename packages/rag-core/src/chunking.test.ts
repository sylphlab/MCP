import { describe, it, expect, beforeEach } from 'vitest';
import { chunkCodeAst } from './chunking.js';
import { SupportedLanguage } from './parsing.js';
import { ChunkingOptionsSchema } from './chunking.js'; // Import schema for options type

// Mock the parsing module to avoid actual WASM loading during basic tests
// vi.mock('./parsing.js', () => ({
//   parseCode: vi.fn().mockResolvedValue({ rootNode: { text: '', children: [] } }), // Simple mock
//   SupportedLanguage: { // Need to mock the enum values used
//       JavaScript: 'javascript',
//       TypeScript: 'typescript',
//       Python: 'python',
//       // Add others if needed by tests
//   }
// }));

describe('chunkCodeAst', () => {

  it('should return a single chunk if content is smaller than maxChunkSize (fallback)', async () => {
    const code = "This is a short text.";
    const options = ChunkingOptionsSchema.parse({ maxChunkSize: 100, chunkOverlap: 10 });
    // Pass null language to trigger fallback
    const chunks = await chunkCodeAst(code, null, options);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe(code);
    expect(chunks[0].metadata?.warning).toContain('Fallback text split applied');
  });

  it('should split text using fallback when language is null', async () => {
    const code = "This is a longer text that definitely needs to be split into multiple chunks based on size.";
    const options = ChunkingOptionsSchema.parse({ maxChunkSize: 20, chunkOverlap: 5 });
    const chunks = await chunkCodeAst(code, null, options);

    expect(chunks.length).toBeGreaterThan(1);
    // Check overlap (approximate check)
    expect(chunks[1].content.startsWith(chunks[0].content.slice(-5))).toBe(true);
    // Check total length (approximate)
    expect(chunks.map(c => c.content).join('').length).toBeGreaterThanOrEqual(code.length);
    // Check individual chunk size (first chunk might be smaller due to no preceding overlap)
    expect(chunks[0].content.length).toBeLessThanOrEqual(options.maxChunkSize);
    if (chunks.length > 1) {
       // Subsequent chunks should be around maxSize + overlap, but splitTextWithOverlap logic is complex
       // Let's just check they don't grossly exceed max size
       expect(chunks[1].content.length).toBeLessThanOrEqual(options.maxChunkSize + options.chunkOverlap);
    }
     expect(chunks[0].metadata?.warning).toContain('Fallback text split applied');
  });

  // TODO: Add tests for AST chunking (JavaScript, TypeScript, Python)
  // These will require more complex setup, potentially mocking the tree-sitter AST structure

  // TODO: Add tests for overlap logic in AST chunking combination

  // TODO: Add tests for metadata generation (line numbers, node types)

});