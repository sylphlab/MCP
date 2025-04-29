import fs from 'node:fs/promises'; // Use node: protocol
import path from 'node:path'; // Use node: protocol
import fg from 'fast-glob';
import { fileURLToPath } from 'node:url'; // Use node: protocol

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..'); // Assuming script is in 'scripts' folder at root
const packagesDir = path.join(rootDir, 'packages');

async function refactorToolFile(filePath) { // This function IS used by run()
  console.log(`\n--- Processing: ${path.relative(rootDir, filePath)} ---`); // Add separators
  try { // START try block here, covering the whole function logic
    let content = await fs.readFile(filePath, 'utf-8');
    let changed = false; // Keep track if any change happened

    // Regex to find defineTool({...}) block and capture its content
    const defineToolRegex = /(export\s+const\s+\w+\s*=\s*defineTool\()(\{[\s\S]*?\n\}\))/;
    const match = content.match(defineToolRegex);

    if (!match) {
      console.log('  -> No defineTool block found. Skipping.');
      return;
    }
    console.log('  -> Found defineTool block.');

    const defineToolCall = match[1]; // e.g., "export const myTool = defineTool("
    let toolDefinition = match[2]; // The object literal {...}
    // const originalToolDefinition = toolDefinition; // Remove unused variable

    // 1. Determine Context Schema
    let contextSchemaName = 'BaseContextSchema'; // Default
    let contextTypeName = 'ToolExecuteOptions'; // Default TS type
    let importPath = '@sylphlab/tools-core';
    let needsSchemaImport = true;

    if (filePath.includes(path.join('tools-memory', 'src', 'tools'))) {
      contextSchemaName = 'MemoryContextSchema';
      contextTypeName = 'MemoryToolExecuteOptions'; // Assuming this type exists or we use MemoryContext
      importPath = '../types.js'; // Corrected relative path
      needsSchemaImport = true; // MemoryContextSchema is in types.ts
       console.log(`  -> Detected Memory tool. Using ${contextSchemaName}.`);
    } else if (filePath.includes(path.join('tools-rag', 'src', 'tools'))) {
      contextSchemaName = 'RagContextSchema';
      contextTypeName = 'RagToolExecuteOptions'; // Assuming this type exists or we use RagContext
      importPath = '../types.js'; // Corrected relative path
      needsSchemaImport = true; // RagContextSchema is in types.ts
       console.log(`  -> Detected RAG tool. Using ${contextSchemaName}.`);
    } else {
       console.log(`  -> Using default ${contextSchemaName}.`);
       // BaseContextSchema should be imported from @sylphlab/tools-core
    }


    // 2. Add contextSchema if not present
    let contextSchemaAdded = false;
    if (!toolDefinition.includes('contextSchema:')) {
      // Add contextSchema after inputSchema
      const replacement = `$1\n  contextSchema: ${contextSchemaName},`;
      const newToolDefinition = toolDefinition.replace(/(\s*inputSchema:\s*\w+,)/, replacement);
      if (newToolDefinition !== toolDefinition) {
          toolDefinition = newToolDefinition;
          contextSchemaAdded = true;
          console.log(`  -> Added contextSchema: ${contextSchemaName}.`);
      } else {
          console.log('  -> Could not find place to add contextSchema (inputSchema might be missing or formatted differently).');
      }
    } else {
       console.log('  -> contextSchema already exists.');
    }

    // 3. Modify execute signature and body
    // Regex to match the old (input, options) signature
    // Groups: 1: "execute: async (", 2: inputVar, 3: inputType, 4: optionsVar, 5: optionsType, 6: ") : Promise<Part[]> => {"
    const executeRegexOld = /(execute:\s*async\s*\()\s*(\w+)\s*:\s*(\w+)\s*(?:,\s*(\w+)\s*:\s*([\w<>, ]+))?\s*(\)\s*:\s*Promise<Part\[\]>\s*=>\s*\{)/;

    // Regex to match the intermediate signature with explicit types in destructuring
    // Groups: 1: "execute: async (", 2: contextType, 3: argsType, 4: ") : Promise<Part[]> => {"
    const executeRegexIntermediate = /(execute:\s*async\s*\()\s*\{\s*context\s*,\s*args\s*\}\s*:\s*\{\s*context\s*:\s*(\w+)\s*;\s*args\s*:\s*(\w+)\s*\}\s*(\)\s*:\s*Promise<Part\[\]>\s*=>\s*\{)/;

    let signatureUpdated = false;
    let signatureMatchFound = false;

    // Try replacing the old (input, options) signature first
    toolDefinition = toolDefinition.replace(executeRegexOld, (_fullMatch, p1, _p2, _p3, _p4, _p5, p6) => {
      signatureMatchFound = true;
      signatureUpdated = true;
      console.log('  -> Updating execute signature (from input, options).');
      return `${p1}{ context, args }${p6}`; // Use simple destructuring
    });

    // If not updated, try replacing the intermediate signature with explicit types
    if (!signatureMatchFound) {
      toolDefinition = toolDefinition.replace(executeRegexIntermediate, (_fullMatch, p1, _contextType, _argsType, p4) => {
        signatureMatchFound = true;
        signatureUpdated = true;
        console.log('  -> Updating execute signature (from explicit destructuring types).');
        return `${p1}{ context, args }${p4}`; // Use simple destructuring
      });
    }

    if (!signatureMatchFound) {
        console.log('  -> No matching execute signature found to update.');
    } else if (!signatureUpdated) {
        // This case should not happen with the current logic, but good for debugging
        console.log('  -> Execute signature matched but replacement failed?');
    }


    // 4. Replace input. and options. inside the execute body
    // This needs to be done carefully *within* the execute block only
    // Groups: 1: Start of execute, 2: Body, 3: End of execute
    const executeBodyRegex = /(execute:\s*async\s*\([\s\S]*?\)\s*:\s*Promise<Part\[\]>\s*=>\s*\{)([\s\S]*?)(\n\s*\},\n\}\))/;
     let bodyChangedCount = 0;
     toolDefinition = toolDefinition.replace(executeBodyRegex, (_fullMatch, p1, p2, p3) => {
         let body = p2;
         // Replace options.xxx with context.xxx
         body = body.replace(/(?<![.\w])(options|_options)\.(\w+)/g, (match, _prefix, prop) => {
             bodyChangedCount++;
             console.log(`    - Replacing ${match} with context.${prop}`);
             return `context.${prop}`;
         });
         // Replace input.xxx with args.xxx
         body = body.replace(/(?<![.\w])(input|_input)\.(\w+)/g, (match, _prefix, prop) => {
             bodyChangedCount++;
              console.log(`    - Replacing ${match} with args.${prop}`);
             return `args.${prop}`;
         });

         if (bodyChangedCount > 0) {
             console.log(`  -> Replaced ${bodyChangedCount} occurrences of input./options. with args./context.`);
             changed = true; // Mark overall change if body was modified
         } else {
             console.log('  -> No input./options. replacements needed in body.');
         }
         return p1 + body + p3;
     });


    // 5. Add necessary imports if changed
    if (contextSchemaAdded || signatureUpdated) { // Only add imports if schema was added or signature changed
      const importsToAdd = [];
      if (needsSchemaImport && !content.includes(contextSchemaName)) {
          // Add import for specific context schema if needed
          importsToAdd.push(`import { ${contextSchemaName} } from '${importPath}';`);
      }
      if (contextSchemaName === 'BaseContextSchema' && !content.includes('BaseContextSchema')) {
           importsToAdd.push(`import { BaseContextSchema } from '@sylphlab/tools-core';`);
      }
      // Add import for the specific context *type* if not already present (needed for execute signature)
      if (!content.includes(contextTypeName) && contextTypeName !== 'ToolExecuteOptions') {
           importsToAdd.push(`import type { ${contextTypeName} } from '${importPath}';`);
      }
       // Ensure ToolExecuteOptions is imported if BaseContextSchema is used or if it's the default
       if (!content.includes('ToolExecuteOptions') && (contextSchemaName === 'BaseContextSchema' || contextTypeName === 'ToolExecuteOptions')) {
           // Check if it's already imported with an alias
           if (!content.match(/import type {.*ToolExecuteOptions\s+as\s+\w+.*}/)) {
              importsToAdd.push(`import type { ToolExecuteOptions } from '@sylphlab/tools-core';`);
           }
       }


      if (importsToAdd.length > 0) {
        // Find the last import statement to add new imports after
        const lastImportMatch = content.match(/^(import\s+.*?;\s*)+/m);
        const insertIndex = lastImportMatch ? lastImportMatch[0].length : 0;
        // Use template literal for concatenation
        content = `${content.slice(0, insertIndex)}${importsToAdd.join('\n')}\n${content.slice(insertIndex)}`;
         console.log(`  -> Added imports: ${importsToAdd.join(', ')}`);
         changed = true; // Mark overall change if imports were added
      }
    }

    // Only write if there were actual changes to the definition block or imports
    // Use the 'changed' flag to determine if writing is needed
    if (changed) { // Simplified check: if any part marked changed=true, write the file
        // Replace the old defineTool block with the modified one
        content = content.replace(defineToolRegex, defineToolCall + toolDefinition);
        await fs.writeFile(filePath, content, 'utf-8');
        console.log('  -> File updated successfully.');
    } else {
        console.log('  -> No structural changes needed.');
    } // End of the main logic block

  } catch (error) { // Catch errors during file processing
      console.error(`  -> Error processing file ${path.relative(rootDir, filePath)}: ${error instanceof Error ? error.message : String(error)}`); // Ensure error message is handled and log file path
  } // END catch block here
} // End of refactorToolFile function

async function run() {
  const toolFiles = await fg([
    `${packagesDir}/tools-*/src/tools/*.ts`,
    `!${packagesDir}/**/node_modules/**`,
    `!${packagesDir}/**/*.test.ts`,
    `!${packagesDir}/**/*.schema.ts`,
     // Process ALL tools, including memory, base64, pdf etc.
  ]);

   // No need to manually add back tools

  for (const file of toolFiles) {
    try {
      await refactorToolFile(file);
    } catch (error) {
      console.error(`Error processing ${file}:`, error);
    }
  }

  console.log('\nRefactoring script finished.');
}

run();