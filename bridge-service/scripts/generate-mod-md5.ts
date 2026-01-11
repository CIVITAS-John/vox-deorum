// Script to auto-generate MD5 hashes for files referenced in VoxDeorum.modinfo
// This ensures the mod can be properly uploaded and validated by Civ V

import { readFile, writeFile } from 'fs/promises';
import { createHash } from 'crypto';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to the modinfo file
const modinfoPath = resolve(__dirname, '../../civ5-mod/VoxDeorum.modinfo');
const civ5ModDir = resolve(__dirname, '../../civ5-mod');

/**
 * Calculate MD5 hash for a file
 */
async function calculateMd5(filePath: string): Promise<string> {
  const content = await readFile(filePath);
  return createHash('md5').update(content).digest('hex').toUpperCase();
}

/**
 * Parse XML and extract file paths from <File> elements
 */
function extractFilePaths(xmlContent: string): string[] {
  const fileRegex = /<File[^>]*>([^<]+)<\/File>/g;
  const paths: string[] = [];
  let match;

  while ((match = fileRegex.exec(xmlContent)) !== null) {
    paths.push(match[1]);
  }

  return paths;
}

/**
 * Update MD5 attributes in the XML content
 */
async function updateMd5InXml(xmlContent: string): Promise<string> {
  const filePaths = extractFilePaths(xmlContent);
  let updatedXml = xmlContent;

  console.log(`Found ${filePaths.length} files to process:\n`);

  for (const relativePath of filePaths) {
    const fullPath = resolve(civ5ModDir, relativePath);

    try {
      const md5 = await calculateMd5(fullPath);
      console.log(`✓ ${relativePath}`);
      console.log(`  MD5: ${md5}`);

      // Replace the md5 attribute for this specific file
      // Match the File element containing this exact path
      const escapedPath = relativePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const fileElementRegex = new RegExp(
        `(<File[^>]*md5=")[^"]*("[^>]*>${escapedPath}</File>)`,
        'g'
      );

      updatedXml = updatedXml.replace(fileElementRegex, `$1${md5}$2`);
    } catch (error) {
      console.error(`✗ ${relativePath}`);
      console.error(`  Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }

  return updatedXml;
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('Reading VoxDeorum.modinfo...\n');

    // Read the modinfo file (with BOM support)
    const xmlContent = await readFile(modinfoPath, 'utf-8');

    // Update MD5 hashes
    const updatedXml = await updateMd5InXml(xmlContent);

    // Write back to file with UTF-8 BOM
    const bom = '\uFEFF';
    const contentWithBom = updatedXml.startsWith(bom) ? updatedXml : bom + updatedXml;
    await writeFile(modinfoPath, contentWithBom, 'utf-8');

    console.log('\n✓ Successfully updated VoxDeorum.modinfo with MD5 hashes');
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
