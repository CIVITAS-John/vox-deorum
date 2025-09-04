import { FeatureTypes } from "../../database/enums/FeatureTypes.js";
import { PlotTypes } from "../../database/enums/PlotTypes.js";
import { TerrainTypes } from "../../database/enums/TerrainTypes.js";
import { UnitAITypes } from "../../database/enums/UnitAITypes.js";

// Mappings between object keys and mappings.
export const enumMappings: Record<string, Record<number, string>> = {
  "TerrainType": TerrainTypes,
  "FeatureType": FeatureTypes,
  "PlotType": PlotTypes,
  "AIType": UnitAITypes
}

/**
 * Recursively scans through an object and replaces enum values with their mappings
 * @param obj The object to scan and transform
 * @returns A new object with enum values replaced by their mappings
 */
export function explainEnums<T extends Record<string, any>>(obj: T): T {
  const entries = Object.entries(obj);
  // Handle objects
  for (const [key, value] of entries) {
    // Check if this key has an enum mapping
    if (key in enumMappings) {
      const enumMapping = enumMappings[key];
      // Try to replace the value with the enum mapping
      if (typeof value === 'number' && value in enumMapping) {
        (obj as any)[key] = enumMapping[value];
      } else {
        // Keep original value if not found in mapping
        (obj as any)[key] = value;
      }
    } else if (typeof value === 'object' && value !== null) {
      // Recursively process nested objects
      (obj as any)[key] = explainEnums(value);
    } else {
      // Keep original value for non-mapped keys
      (obj as any)[key] = value;
    }
  }
  return obj;
}