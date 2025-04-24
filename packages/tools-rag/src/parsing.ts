import type { Parser, Tree } from '@lezer/common'; // Core Lezer types
import { parser as cssParser } from '@lezer/css';
import { parser as htmlParser } from '@lezer/html';
// Import specific language parsers
import { parser as jsParser } from '@lezer/javascript';
import { parser as jsonParser } from '@lezer/json';
import { parser as mdParser } from '@lezer/markdown'; // Assuming standard markdown parser
import { parser as pyParser } from '@lezer/python';
import { parser as xmlParser } from '@lezer/xml';

// Define supported languages using keys that match imports/logic
// NOTE: Lezer's JS parser often handles TS/TSX well enough for basic structure.
// If specific TS features are needed, a separate TS grammar might be required,
// but Lezer doesn't have an official one like tree-sitter did.
export enum SupportedLanguage {
  JavaScript = 'javascript',
  TypeScript = 'typescript', // Will use JS parser
  TSX = 'tsx', // Will use JS parser
  Python = 'python',
  Markdown = 'markdown',
  JSON = 'json',
  CSS = 'css',
  HTML = 'html',
  XML = 'xml',
  // Add others as needed
}

// Map language enum to the corresponding Lezer parser instance
// Note: Using jsParser for ts/tsx
const lezerParsers: Partial<Record<SupportedLanguage, Parser>> = {
  [SupportedLanguage.JavaScript]: jsParser,
  [SupportedLanguage.TypeScript]: jsParser, // Use JS parser for TS
  [SupportedLanguage.TSX]: jsParser, // Use JS parser for TSX
  [SupportedLanguage.Python]: pyParser,
  [SupportedLanguage.Markdown]: mdParser,
  [SupportedLanguage.JSON]: jsonParser,
  [SupportedLanguage.CSS]: cssParser,
  [SupportedLanguage.HTML]: htmlParser,
  [SupportedLanguage.XML]: xmlParser,
};

/**
 * Parses the given code string using the specified language grammar with Lezer.
 *
 * @param code The source code to parse.
 * @param language The language of the source code.
 * @returns The Lezer syntax Tree.
 * @throws Error if the language is not supported.
 */
export function parseCode(code: string, language: SupportedLanguage): Tree {
  const parser = lezerParsers[language];

  if (!parser) {
    // Throw an error if no parser is configured for the language
    throw new Error(`Unsupported language for Lezer parser: ${language}`);
  }
  try {
    // Lezer parse is synchronous
    const tree = parser.parse(code);
    return tree;
  } catch (error) {
    throw new Error(
      `Lezer parsing failed for language ${language}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// No need for initializeParser, loadLanguage, or _resetParsingState with Lezer's synchronous API

/** @internal Exported only for testing purposes - NO LONGER NEEDED */
// export { loadLanguage as _loadLanguage_for_test };
/** @internal Exported only for testing purposes - NO LONGER NEEDED */
// export function _resetParsingState(): void {
//   console.warn('[TESTING] Resetting parsing state (parser and loaded languages)');
//   // No state to reset for Lezer in this implementation
// }
