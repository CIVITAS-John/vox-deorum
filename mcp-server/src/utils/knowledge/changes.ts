/**
 * Utility functions for detecting changes in MutableKnowledge entries
 */

/**
 * Detect changes between two objects for MutableKnowledge versioning
 * Returns an array of field names that have changed
 * 
 * @param oldData - Previous version data (null if first version)
 * @param newData - New version data
 * @returns Array of changed field names
 */
export function detectChanges<T extends Record<string, any>>(
  oldData: T | null,
  newData: T
): string[] {
  if (!oldData) {
    // If no previous version exists, all fields are considered changes
    return Object.keys(newData).filter(key => !isMetadataField(key) && !isVisibilityField(key));
  }

  const changes: string[] = [];
  for (const key in newData) {
    // Skip metadata fields
    if (isMetadataField(key)) {
      continue;
    }
    // Skip player visibility fields  
    if (isVisibilityField(key)) {
      continue;
    }
    
    // Compare values (handle JSON fields properly)
    const oldValue = oldData[key];
    const newValue = newData[key];
    
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changes.push(key);
    }
  }
  
  return changes;
}

/**
 * Check if a field is a metadata field that should be excluded from change detection
 */
function isMetadataField(key: string): boolean {
  return ['ID', 'Turn', 'Key', 'Version', 'IsLatest', 'CreatedAt', 'Changes', 'Payload'].includes(key);
}

/**
 * Check if a field is a player visibility field
 */
function isVisibilityField(key: string): boolean {
  return key.startsWith('Player') && /Player\d+/.test(key);
}