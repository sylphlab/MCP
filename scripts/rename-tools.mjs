import fs from 'node:fs/promises';
import path from 'node:path';
import { glob } from 'glob';

// Function to convert camelCase/PascalCase to kebab-case
function toKebabCase(str) {
  if (str === str.toLowerCase()) {
    // Already likely kebab or snake, don't change
    return str;
  }
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2') // Get all lowercase letters that are near uppercase letters
    .replace(/[\s_]+/g, '-') // Replace spaces and underscores with dashes
    .toLowerCase(); // Convert to lowercase
}

async function renameToolNames() {
  const workspaceRoot = process.cwd(); // Assumes script is run from workspace root
  const files = await glob('packages/**/src/tools/*.ts', { cwd: workspaceRoot, absolute: true, ignore: '**/node_modules/**' });
  let changesMade = 0;
  const errors = [];

  console.log(`Found ${files.length} potential tool files to check.`);

  for (const file of files) {
    try {
      const originalContent = await fs.readFile(file, 'utf-8');
      let newContent = originalContent;
      let fileChanged = false;

      // Regex to find name: 'toolName' within defineTool({ ... })
      // It captures the part before the name, the name itself, and the part after
      const regex = /(defineTool\(\s*\{[\s\S]*?name:\s*')([a-zA-Z-]+)('[\s\S]*?\}\))/g; // Allow hyphens in current name

      newContent = originalContent.replace(regex, (match, prefix, currentName, suffix) => {
        // Convert original camel/pascal or existing kebab to base kebab first
        let kebabName = toKebabCase(currentName);

        // Remove trailing '-tool' if present
        if (kebabName.endsWith('-tool')) {
          kebabName = kebabName.slice(0, -5); // Remove the last 5 characters ('-tool')
        }

        // Only log and mark as changed if the final name is different from the current name in the file
        if (currentName !== kebabName) {
          console.log(`Renaming '${currentName}' to '${kebabName}' in ${path.relative(workspaceRoot, file)}`);
          fileChanged = true;
          changesMade++;
          return `${prefix}${kebabName}${suffix}`;
        }
        // If no change needed, return the original match
        return match;
      });

      if (fileChanged) {
        await fs.writeFile(file, newContent, 'utf-8');
        console.log(`Successfully updated ${path.relative(workspaceRoot, file)}`);
      }
    } catch (error) {
      console.error(`Error processing file ${path.relative(workspaceRoot, file)}:`, error);
      errors.push({ file: path.relative(workspaceRoot, file), error: error.message });
    }
  }

  console.log('\nFinished processing.');
  console.log(`Total changes made: ${changesMade}`);
  if (errors.length > 0) {
    console.error('\nErrors occurred during processing:');
    for (const err of errors) {
      console.error(`- ${err.file}: ${err.error}`);
    }
  }
}

renameToolNames().catch(console.error);