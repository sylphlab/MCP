import { Parser, Language, Tree } from 'web-tree-sitter';
import path from 'node:path'; // Use node:path for clarity
import { fileURLToPath } from 'node:url';

// Define supported languages - align keys with grammar package names/wasm files
export enum SupportedLanguage {
  JavaScript = 'javascript',
  TypeScript = 'typescript',
  TSX = 'tsx', // TSX often needs a separate grammar or configuration
  Python = 'python',
  // Markdown = 'markdown', // Removed again
}

// Map language enum to the expected WASM file names
// IMPORTANT: These paths assume the .wasm files will be copied to the dist directory during build
const languageWasmPaths: Partial<Record<SupportedLanguage, string>> = { // Make Partial again
  [SupportedLanguage.JavaScript]: 'tree-sitter-javascript.wasm',
  [SupportedLanguage.TypeScript]: 'tree-sitter-typescript.wasm',
  [SupportedLanguage.TSX]: 'tree-sitter-tsx.wasm', // Assumes a tsx wasm file exists
  [SupportedLanguage.Python]: 'tree-sitter-python.wasm',
  // [SupportedLanguage.Markdown]: 'tree-sitter-markdown.wasm', // Removed again
};

let parser: Parser | null = null;
const loadedLanguages: Partial<Record<SupportedLanguage, Language>> = {};

// Determine the directory where WASM files are located (relative to dist)
// Using import.meta.url is the standard way in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const wasmDir = path.resolve(__dirname); // Assumes WASM files are alongside the built JS

/**
 * Initializes the Tree-sitter parser. Must be called before parsing.
 */
async function initializeParser(): Promise<void> {
  if (parser) return;
  await Parser.init();
  parser = new Parser();
  console.log('Tree-sitter parser initialized.');
}

/**
 * Loads the grammar for a specific language.
 * @param language The language to load.
 */
async function loadLanguage(language: SupportedLanguage): Promise<Language> {
  if (!parser) {
    throw new Error('Parser not initialized. Call initializeParser() first.');
  }
  if (loadedLanguages[language]) {
    return loadedLanguages[language]!;
  }

  const wasmFileName = languageWasmPaths[language]; // Get potentially undefined filename
  if (!wasmFileName) {
      // This should ideally not be reached if called via parseCode, but handles direct calls
      throw new Error(`[loadLanguage] Unsupported language or missing WASM path for: ${language}`);
  }

  const wasmPath = path.join(wasmDir, wasmFileName); // wasmFileName is string here
  console.log(`Loading grammar for ${language} from ${wasmPath}`);
  try {
    const lang = await Language.load(wasmPath);
    loadedLanguages[language] = lang;
    console.log(`Grammar for ${language} loaded successfully.`);
    return lang;
  } catch (error) {
    console.error(`Failed to load grammar for ${language} from ${wasmPath}:`, error);
    throw new Error(`Failed to load grammar for ${language}`);
  }
}

/**
 * Parses the given code string using the specified language grammar.
 * Ensures parser is initialized and language is loaded.
 *
 * @param code The source code to parse.
 * @param language The language of the source code.
 * @returns The Tree-sitter AST Tree.
 */
export async function parseCode(code: string, language: SupportedLanguage): Promise<Tree> {
  await initializeParser(); // Ensure parser is ready
  if (!parser) throw new Error('Parser initialization failed.');

  const wasmFileName = languageWasmPaths[language]; // Check if path exists
  if (!wasmFileName) {
      throw new Error(`Unsupported language or missing WASM path for: ${language}`);
  }

  const lang = await loadLanguage(language); // Ensure language is loaded
  parser.setLanguage(lang);
  const tree = parser.parse(code);
  if (!tree) {
    throw new Error(`Failed to parse code for language ${language}. Parser returned null.`);
  }
  return tree;
}

// Optional: Pre-load common languages on startup?
// initializeParser().then(() => {
//   loadLanguage(SupportedLanguage.TypeScript);
//   loadLanguage(SupportedLanguage.Markdown);
// });