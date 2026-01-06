/**
 * Utility functions for file operations
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from './logger.js';

const logger = createLogger('FileUtils');

/**
 * Write content to a file only if it has changed
 *
 * @param filePath - Absolute path to the file
 * @param content - Content to write as a string
 * @param logName - Name to use in log messages (defaults to filename)
 * @returns true if file was written, false if skipped due to no changes
 */
export async function writeIfChanged(
  filePath: string,
  content: string,
  logName?: string
): Promise<boolean> {
  const fileName = logName || path.basename(filePath);

  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    // Check if file exists and compare content
    let shouldWrite = true;
    try {
      const existingContent = await fs.readFile(filePath, 'utf-8');
      shouldWrite = existingContent !== content;
    } catch {
      // File doesn't exist or can't be read, proceed with write
    }

    if (shouldWrite) {
      await fs.writeFile(filePath, content, 'utf-8');
      logger.debug(`Updated ${fileName} with new content`);
      return true;
    } else {
      logger.debug(`Skipping ${fileName} write - no content changes`);
      return false;
    }
  } catch (error: any) {
    logger.warn(`Warning writing ${fileName}: ${error.message}`);
    throw error;
  }
}

/**
 * Write JSON to a file only if the content has changed (ignoring whitespace differences)
 *
 * @param filePath - Absolute path to the JSON file
 * @param data - Data to serialize and write
 * @param logName - Name to use in log messages (defaults to filename)
 * @returns true if file was written, false if skipped due to no changes
 */
export async function writeJsonIfChanged(
  filePath: string,
  data: any,
  logName?: string
): Promise<boolean> {
  const fileName = logName || path.basename(filePath);

  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const newContent = JSON.stringify(data, null, 2);

    // Check if file exists and compare normalized content
    let shouldWrite = true;
    try {
      const existingContent = await fs.readFile(filePath, 'utf-8');
      // Normalize both by parsing and re-stringifying without formatting
      const existingNormalized = JSON.stringify(JSON.parse(existingContent));
      const newNormalized = JSON.stringify(data);
      shouldWrite = existingNormalized !== newNormalized;
    } catch {
      // File doesn't exist or can't be read, proceed with write
    }

    if (shouldWrite) {
      await fs.writeFile(filePath, newContent, 'utf-8');
      logger.debug(`Updated ${fileName} with new content`);
      return true;
    } else {
      logger.debug(`Skipping ${fileName} write - no content changes`);
      return false;
    }
  } catch (error: any) {
    logger.warn(`Warning writing ${fileName}: ${error.message}`);
    throw error;
  }
}
