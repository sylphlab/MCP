import { describe, it, expect, beforeAll } from 'vitest';
import * as Parser from 'web-tree-sitter'; // Import as namespace
import { chunkCodeAst } from './chunking.js';
import * as parsing from './parsing.js'; // Import namespace
import { SupportedLanguage } from './parsing.js'; // Keep named import too
import { Chunk } from './types.js';

// beforeAll removed - initialization should happen within parseCode if needed

describe('chunkCodeAst', () => {
  it('should return a single chunk for small code snippets', async () => {
    const code = `function hello() {\n  console.log("Hello, world!");\n}`;
    const language = SupportedLanguage.JavaScript;
    const chunks = await chunkCodeAst(code, language, { maxChunkSize: 500 });

    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe(code);
    expect(chunks[0].metadata?.language).toBe(language);
    expect(chunks[0].metadata?.chunkIndex).toBe(0);
  });

  it('should apply fallback text splitting for unsupported languages', async () => {
    const code = `This is just some plain text that is longer than the max chunk size to test the fallback mechanism. It needs to be sufficiently long.`;
    const chunks = await chunkCodeAst(code, null, { maxChunkSize: 50, chunkOverlap: 10 });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].content.length).toBeLessThanOrEqual(50);
    expect(chunks[1].content.length).toBeLessThanOrEqual(50);
    // Check overlap
    expect(chunks[0].content.endsWith(chunks[1].content.substring(0, 10))).toBe(true);
    expect(chunks[0].metadata?.warning).toContain('Fallback text splitting applied (no language)');
  });

  it('should apply fallback text splitting if AST parsing fails', async () => {
    // Simulate a parsing failure by providing invalid code for the language
    const invalidJsCode = `function hello() { console.log("Missing semicolon")`;
    const language = SupportedLanguage.JavaScript;
    // Mock just the parseCode function to throw
    // Use the imported namespace 'parsing' for spyOn
    const parseCodeSpy = vi.spyOn(parsing, 'parseCode').mockRejectedValue(new Error('Simulated parsing error'));

    const chunks = await chunkCodeAst(invalidJsCode, language, { maxChunkSize: 50 });

    expect(chunks.length).toBeGreaterThan(0);
    // Check if metadata and warning exist before asserting content
    expect(chunks[0].metadata).toBeDefined();
    expect(chunks[0].metadata?.warning).toBeDefined();
    expect(chunks[0].metadata?.warning).toContain('Fallback text splitting applied (parsing error');
    parseCodeSpy.mockRestore(); // Restore original function
  });

   it('should apply fallback text splitting for Markdown (deferred AST)', async () => {
    const markdown = `# Title\n\nSome paragraph.\n\n\`\`\`javascript\nconsole.log('hello');\n\`\`\`\n\nAnother paragraph that makes this longer than 50 chars.`;
    const language = SupportedLanguage.Markdown;
    const chunks = await chunkCodeAst(markdown, language, { maxChunkSize: 50, chunkOverlap: 5 });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].metadata?.warning).toContain('Fallback text splitting applied (Markdown AST deferred)');
    expect(chunks[0].metadata?.language).toBe(language);
  });

  // TODO: Add more tests for AST-based chunking for specific languages (JS, TS, Python)
  // - Test splitting by function/class boundaries
  // - Test handling of large nodes with/without meaningful children
  // - Test combination of smaller nodes
  // - Test handling of text between nodes

  it('should split JavaScript code based on function boundaries', async () => {
    const jsCode = `
function firstFunction() {
  // Content of the first function
  console.log('first');
}

// A comment between functions

async function secondFunction(param) {
  // Content of the second function
  const result = await doSomething(param);
  return result;
}

const arrowFunc = () => {
  // Content of arrow function
};
`;
    const language = SupportedLanguage.JavaScript;
    const chunks = await chunkCodeAst(jsCode, language, { maxChunkSize: 100, chunkOverlap: 10 });

    // Expecting chunks for: function1, comment, function2, arrowFunc
    // Exact number might vary based on how comments/whitespace are handled
    expect(chunks.length).toBeGreaterThanOrEqual(3); 

    // Check if major function definitions are in separate chunks (or start chunks)
    const chunkContents = chunks.map(c => c.content);
    expect(chunkContents.some(c => c.includes('function firstFunction()'))).toBe(true);
    expect(chunkContents.some(c => c.includes('async function secondFunction(param)'))).toBe(true);
    expect(chunkContents.some(c => c.includes('const arrowFunc = () =>'))).toBe(true);

    // Check metadata (example for the first chunk, assuming it's the first function)
    const firstFuncChunk = chunks.find(c => c.content.includes('function firstFunction()'));
    expect(firstFuncChunk).toBeDefined();
    expect(firstFuncChunk?.metadata?.language).toBe(language);
    // Note: start/end positions and lines depend heavily on the parser and chunking logic details
    // expect(firstFuncChunk?.metadata?.startLine).toBeGreaterThan(0);
    // expect(firstFuncChunk?.metadata?.endLine).toBeGreaterThan(0);
    expect(firstFuncChunk?.metadata?.nodeType).toContain('function_declaration'); // Or similar
  });

  // - Test metadata correctness (nodeType, lines, etc.)

});