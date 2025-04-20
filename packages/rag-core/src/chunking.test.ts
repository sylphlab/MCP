import { describe, it, expect, vi } from 'vitest';
import { chunkCodeAst, detectLanguage } from './chunking.js';
import { SupportedLanguage } from './parsing.js';
import { Document, Chunk } from './types.js';
import * as parsing from './parsing.js'; // Import the module to mock

// Mock the parsing module
vi.mock('./parsing.js', async (importOriginal) => {
  const original = await importOriginal<typeof parsing>();
  return {
    ...original,
    // Mock parseCode to return a simplified mock tree or null
    parseCode: vi.fn().mockImplementation(async (code, lang) => {
      if (lang === SupportedLanguage.JavaScript && code.includes('function hello')) {
        // Return a mock tree structure for specific test cases if needed
        return {
          rootNode: {
            type: 'program',
            text: code,
            startIndex: 0,
            endIndex: code.length,
            startPosition: { row: 0, column: 0 },
            endPosition: { row: code.split('\n').length -1, column: code.split('\n').slice(-1)[0].length },
            children: [
              {
                type: 'function_declaration',
                text: 'function hello() { console.log("Hello"); }',
                startIndex: code.indexOf('function hello'),
                endIndex: code.indexOf('}') + 1,
                startPosition: { row: code.split('\n').findIndex(l => l.includes('function hello')), column: 0 },
                endPosition: { row: code.split('\n').findIndex(l => l.includes('}')), column: 1 },
                children: [] // Simplified
              }
            ]
          }
        };
      } else if (lang && code.length > 0 && !code.includes('fails parsing')) { // Add condition to exclude failure case
         // Generic mock for other successful parses
         return {
             rootNode: {
                type: 'program', // Generic root
                text: code,
                startIndex: 0,
                endIndex: code.length,
                startPosition: { row: 0, column: 0 },
                endPosition: { row: code.split('\n').length -1, column: code.split('\n').slice(-1)[0].length },
                children: [] // No meaningful children for simplicity in mock
             }
         }
      }
      // Simulate parsing failure for specific tests or by default
      console.warn('Mock parseCode returning null');
      return null;
    }),
  };
});


describe('Chunking Logic', () => {
  // Define constants in the outer scope
  const baseMetadata = { source: 'test.js' };
  const defaultOptions = { maxChunkSize: 100, chunkOverlap: 10 };

  describe('detectLanguage', () => {
    it('should detect JavaScript', () => {
      expect(detectLanguage('test.js')).toBe(SupportedLanguage.JavaScript);
      expect(detectLanguage('path/to/file.jsx')).toBe(SupportedLanguage.JavaScript);
    });

    it('should detect TypeScript', () => {
      expect(detectLanguage('test.ts')).toBe(SupportedLanguage.TypeScript);
    });

     it('should detect TSX', () => {
      expect(detectLanguage('component.tsx')).toBe(SupportedLanguage.TSX);
    });

    it('should detect Python', () => {
      expect(detectLanguage('script.py')).toBe(SupportedLanguage.Python);
    });

    it('should return null for unknown extensions', () => {
      expect(detectLanguage('document.txt')).toBeNull();
      expect(detectLanguage('image.png')).toBeNull();
      expect(detectLanguage('noextension')).toBeNull();
    });

    it('should handle paths correctly', () => {
      expect(detectLanguage('/users/test/code.js')).toBe(SupportedLanguage.JavaScript);
      expect(detectLanguage('C:\\windows\\system\\script.py')).toBe(SupportedLanguage.Python);
    });
  });

  describe('chunkCodeAst', () => {
    // Constants are defined in outer scope

    it('should use fallback text splitting when language is null', async () => {
      // Text length is 98, maxSize is 100. Should be 1 chunk.
      const code = 'This is a plain text document that is exactly the max chunk size to test the fallback mechanism..'; // Adjusted length to 98
      const chunks = await chunkCodeAst(code, null, defaultOptions, baseMetadata);
      expect(chunks.length).toBe(1);
      expect(chunks[0].content.length).toBeLessThanOrEqual(defaultOptions.maxChunkSize);
      expect(chunks[0].metadata?.warning).toContain('Fallback text splitting applied (no language)');
      expect(chunks[0].metadata?.language).toBeNull();
    });

     // This test should now pass after fixing createChunk
    // TODO: This test fails consistently despite code appearing correct.
    // The warning metadata is undefined during assertion. Needs investigation.
     it('should use fallback text splitting when parsing fails', async () => {
      // parseCode mock will return null by default
      const code = 'Some code that fails parsing';
      const chunks = await chunkCodeAst(code, SupportedLanguage.JavaScript, defaultOptions, baseMetadata);
      expect(chunks.length).toBe(1);
      console.log('[Test] Received chunks:', JSON.stringify(chunks, null, 2));
      // Check if warning property exists and is a string
      expect(chunks[0].metadata?.warning).toBeTypeOf('string');
      expect(chunks[0].metadata?.warning).toContain('Fallback text splitting applied (parsing error'); // Check content
      expect(chunks[0].metadata?.language).toBe(SupportedLanguage.JavaScript);
    });

    it('should use fallback text splitting for Markdown (currently deferred)', async () => {
      const code = '# Markdown\n\nThis is markdown content.\n\n```js\nconsole.log("hello");\n```';
      const chunks = await chunkCodeAst(code, SupportedLanguage.Markdown, defaultOptions, baseMetadata);
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].metadata?.warning).toContain('Fallback text splitting applied (Markdown AST deferred)');
      expect(chunks[0].metadata?.language).toBe(SupportedLanguage.Markdown);
    });

    it('should create a single chunk if code fits and AST parsing succeeds (mocked)', async () => {
        const code = 'function hello() { console.log("Hello"); }'; // Fits in 100 chars
        const chunks = await chunkCodeAst(code, SupportedLanguage.JavaScript, defaultOptions, baseMetadata);
        expect(parsing.parseCode).toHaveBeenCalledWith(code, SupportedLanguage.JavaScript);
        expect(chunks.length).toBe(1);
        expect(chunks[0].content).toBe(code);
        expect(chunks[0].metadata?.language).toBe(SupportedLanguage.JavaScript);
        expect(chunks[0].metadata?.nodeType).toBe('function_declaration'); // Based on mock
    });

     it('should use fallback splitting if a node is too large and has no meaningful children (mocked)', async () => {
        const largeCode = 'a'.repeat(150); // Larger than maxChunkSize
        // Mock parseCode to return a large root node with no meaningful children
        vi.mocked(parsing.parseCode).mockResolvedValueOnce({
             rootNode: {
                type: 'program', text: largeCode, startIndex: 0, endIndex: 150,
                startPosition: { row: 0, column: 0 }, endPosition: { row: 0, column: 150 },
                children: []
             }
        } as any);

        const chunks = await chunkCodeAst(largeCode, SupportedLanguage.JavaScript, defaultOptions, baseMetadata);
        expect(chunks.length).toBeGreaterThan(1); // Should be split by text splitter
        expect(chunks[0].content.length).toBeLessThanOrEqual(defaultOptions.maxChunkSize);
        expect(chunks[0].metadata?.warning).toContain('Fallback split applied to large node');
        expect(chunks[0].metadata?.nodeType).toBe('program'); // From the mocked root node
    });

    // TODO: Add more complex tests involving recursion based on meaningful children
    // These would require more sophisticated mocking of the tree structure returned by parseCode

    it('should handle nested meaningful nodes with text in between (mocked)', async () => {
      const code = `// Comment 1
function outer() {
  // Inner comment
  let x = 1;
  function inner() {
    console.log(x);
  }
  // After inner
}
// Comment 2`;
      const options = { maxChunkSize: 50, chunkOverlap: 5 }; // Smaller size to force splitting

      // Mock a more complex AST
      vi.mocked(parsing.parseCode).mockResolvedValueOnce({
        rootNode: {
          type: 'program', text: code, startIndex: 0, endIndex: code.length,
          startPosition: { row: 0, column: 0 }, endPosition: { row: 9, column: 13 },
          children: [
            { type: 'comment', text: '// Comment 1', startIndex: 0, endIndex: 12, startPosition: { row: 0, column: 0 }, endPosition: { row: 0, column: 12 }, children: [] },
            { type: 'function_declaration', text: 'function outer() {\n  // Inner comment\n  let x = 1;\n  function inner() {\n    console.log(x);\n  }\n  // After inner\n}', startIndex: 13, endIndex: 136, startPosition: { row: 1, column: 0 }, endPosition: { row: 8, column: 1 },
              children: [
                { type: 'comment', text: '// Inner comment', startIndex: 34, endIndex: 51, startPosition: { row: 2, column: 2 }, endPosition: { row: 2, column: 19 }, children: [] },
                { type: 'lexical_declaration', text: 'let x = 1;', startIndex: 54, endIndex: 64, startPosition: { row: 3, column: 2 }, endPosition: { row: 3, column: 12 }, children: [] },
                { type: 'function_declaration', text: 'function inner() {\n    console.log(x);\n  }', startIndex: 67, endIndex: 111, startPosition: { row: 4, column: 2 }, endPosition: { row: 6, column: 3 }, children: [] },
                { type: 'comment', text: '// After inner', startIndex: 114, endIndex: 129, startPosition: { row: 7, column: 2 }, endPosition: { row: 7, column: 17 }, children: [] },
              ]
            },
            { type: 'comment', text: '// Comment 2', startIndex: 137, endIndex: 149, startPosition: { row: 9, column: 0 }, endPosition: { row: 9, column: 12 }, children: [] },
          ]
        }
      } as any);

      const chunks = await chunkCodeAst(code, SupportedLanguage.JavaScript, options, baseMetadata);

      // Assertions (adjust based on expected output with smallFragmentThreshold)
      // Expect multiple chunks, check content and metadata
      expect(chunks.length).toBeGreaterThan(3); // Expecting Comment1, Outer(parts), Comment2
      expect(chunks[0].content).toBe('// Comment 1');
      expect(chunks[1].content).toContain('function outer'); // Might contain prefix text
      // Add more specific assertions based on how the refined logic splits the outer function and its children
      expect(chunks.find(c => c.content.includes('function inner'))).toBeDefined();
      // The last chunk should contain the merged content of the last meaningful node's suffix and the final suffix text
      expect(chunks[chunks.length - 1].content).toBe('// Comment 2'); // Revert assertion: Expect separate chunk now
    });

    // Obsolete prefix/suffix merging tests removed after logic simplification

  });

});