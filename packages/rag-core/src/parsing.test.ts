import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// Import types from lezer
import { Tree, Parser } from '@lezer/common'; // Import Parser type
// Import module under test
import { parseCode, SupportedLanguage } from './parsing.js';
// Import a specific parser to potentially spy on its method
import { parser as jsParser } from '@lezer/javascript';

// --- REMOVE Global Mock ---
// vi.mock('@lezer/javascript', ...);

describe('parsing', () => {

  // No complex beforeEach needed now
  beforeEach(() => {
    // Clear mocks
    vi.clearAllMocks();
    // No global mock to reset
  });

  afterEach(() => {
      vi.restoreAllMocks();
  });

  describe('parseCode with Lezer', () => {

    it('should parse JavaScript code', () => {
      const code = 'const x = 1; function hello() { return "world"; }';
      const language = SupportedLanguage.JavaScript;

      // Lezer parse is synchronous
      const tree = parseCode(code, language);

      expect(tree).toBeInstanceOf(Tree);
      // Basic check: Top node should be 'Script' for JS
      expect(tree.topNode.name).toBe('Script');
      // Check if length matches code length (basic validation)
      expect(tree.length).toBe(code.length);
    });

    it('should parse Python code', () => {
      const code = 'def greet(name):\n  print(f"Hello, {name}")\n\ngreet("Lezer")';
      const language = SupportedLanguage.Python;

      const tree = parseCode(code, language);

      expect(tree).toBeInstanceOf(Tree);
      // Basic check: Top node should be 'Script' or similar for Python
      expect(tree.topNode.name).toBe('Script');
      expect(tree.length).toBe(code.length);
    });

     it('should parse TypeScript code (using JS parser)', () => {
      // Note: Lezer's JS parser handles many TS constructs, but not all type syntax perfectly.
      // This test verifies basic parsing works.
      const code = 'const message: string = "hello"; interface User { id: number; }';
      const language = SupportedLanguage.TypeScript;

      const tree = parseCode(code, language);

      expect(tree).toBeInstanceOf(Tree);
      // JS parser's top node is 'Script'
      expect(tree.topNode.name).toBe('Script');
      expect(tree.length).toBe(code.length);
    });

     it('should parse JSON code', () => {
      const code = '{ "key": "value", "num": 123, "arr": [1, 2] }';
      const language = SupportedLanguage.JSON;

      const tree = parseCode(code, language);

      expect(tree).toBeInstanceOf(Tree);
      expect(tree.topNode.name).toBe('JsonText');
      expect(tree.length).toBe(code.length);
    });

     it('should parse Markdown code', () => {
      const code = '# Header\n\nSome *italic* and **bold** text.\n\n- List item';
      const language = SupportedLanguage.Markdown;

      const tree = parseCode(code, language);

      expect(tree).toBeInstanceOf(Tree);
      expect(tree.topNode.name).toBe('Document'); // Lezer markdown top node
      expect(tree.length).toBe(code.length);
    });

    // Add similar tests for CSS, HTML, XML if needed

    it('should throw if language is unsupported', () => {
        const code = 'some code';
        const unsupportedLang = 'cobol' as any; // Use any cast

        // Use a function wrapper for expect().toThrow() with synchronous code
        const parseFn = () => parseCode(code, unsupportedLang);

        expect(parseFn).toThrow(
            `Unsupported language for Lezer parser: ${unsupportedLang}`
        );
     });

     it('should handle empty code string', () => {
        const code = '';
        const language = SupportedLanguage.JavaScript;

        const tree = parseCode(code, language);
        expect(tree).toBeInstanceOf(Tree);
        expect(tree.length).toBe(0);
        expect(tree.topNode.name).toBe('Script');
     });

     // Lezer parse is synchronous and less likely to throw on malformed input
     // than tree-sitter might have been, it usually produces a tree with error nodes.
     // Testing for specific error nodes could be done but is more complex.
     // it('should handle malformed code gracefully', () => { ... });

     it('should throw wrapped error if Lezer parser fails', () => {
       const code = 'let x = {';
       const language = SupportedLanguage.JavaScript;
       const parseError = new Error('Unexpected end of input');
       // Spy on and mock jsParser.parse *only for this test*
       const parseSpy = vi.spyOn(jsParser, 'parse').mockImplementation(() => { throw parseError; });

       const parseFn = () => parseCode(code, language);

       expect(parseFn).toThrow(
           `Lezer parsing failed for language ${language}: ${parseError.message}`
       );
       expect(parseSpy).toHaveBeenCalledWith(code); // Check the spy
       // Check console.error was called (need to spy on it)
       const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
       try {
           parseFn(); // Call again to trigger console.error
       } catch (e) {
           // Expected throw
       }
       expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining(`Lezer parsing failed for language ${language}`), parseError);
       errorSpy.mockRestore(); // Restore console.error
       parseSpy.mockRestore(); // Restore the original parse method
     });

  });
});