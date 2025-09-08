/**
 * Utility functions for stripping database metadata from knowledge objects
 */

import { MutableKnowledge, TimedKnowledge, Knowledge, MaxMajorCivs } from '../schema/base.js';

/**
 * Strip database metadata fields from a Knowledge object
 * Removes auto-generated fields like ID
 * @param obj Knowledge object with metadata
 * @returns Knowledge object without metadata
 */
export function stripKnowledgeMetadata<T extends Knowledge>(obj: T): Omit<T, 'ID'> {
  const { ID, ...rest } = obj;
  return rest;
}

/**
 * Strip database metadata fields from a TimedKnowledge object
 * Removes auto-generated fields like ID, CreatedAt, and Player visibility fields
 * @param obj TimedKnowledge object with metadata
 * @returns TimedKnowledge object without metadata
 */
export function stripTimedKnowledgeMetadata<T extends TimedKnowledge>(obj: T): Omit<T, 'ID' | 'CreatedAt' | keyof TimedKnowledge> {
  const result: any = {};
  
  for (const key in obj) {
    // Skip ID and CreatedAt
    if (key === 'ID' || key === 'CreatedAt') continue;
    
    // Skip Player visibility fields
    if (key.startsWith('Player') && /^Player\d+$/.test(key)) {
      const playerNum = parseInt(key.substring(6));
      if (!isNaN(playerNum) && playerNum >= 0 && playerNum < MaxMajorCivs) continue;
    }
    
    // Skip base TimedKnowledge fields
    if (key === 'Turn' || key === 'Payload') continue;
    
    result[key] = obj[key];
  }
  
  return result;
}

/**
 * Strip database metadata fields from a MutableKnowledge object
 * Reuses TimedKnowledge stripping and removes additional MutableKnowledge fields
 * @param obj MutableKnowledge object with metadata
 * @param keyFieldName Optional name to rename the Key field (e.g., 'PlayerID')
 * @returns Clean object without database metadata
 */
export function stripMutableKnowledgeMetadata<T extends MutableKnowledge>(
  obj: T, 
  keyFieldName?: string
): Omit<T, keyof MutableKnowledge | 'ID' | 'CreatedAt' | 'Key'> {
  // First strip TimedKnowledge metadata
  const stripped = stripTimedKnowledgeMetadata(obj);
  
  // Remove MutableKnowledge-specific fields except Key
  const { Key, Version, IsLatest, Changes, ...rest } = stripped as any;
  
  // Add Key back with optional rename
  if (keyFieldName)
    rest[keyFieldName] = Key;
  
  return rest;
}