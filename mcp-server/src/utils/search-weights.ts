/**
 * Utilities for calculating weighted fields in database searches
 */

import { search } from "fast-fuzzy";

/**
 * Default field weights for database searches
 * Higher values indicate more importance in search relevance
 */
export const defaultFieldWeights: Record<string, number> = {
  Name: 3.0,
  Type: 2.0,
  Help: 1.0,
  Description: 1.0,
  Strategy: 1.0,
  Branch: 1.0,
  Era: 1.0
};

/**
 * Performs weighted fuzzy search across multiple fields
 * @param keyword - Search keyword
 * @param items - Items to search
 * @param fieldWeights - Weight for each field (higher = more important)
 * @param threshold - Minimum weighted score to include (0-1)
 * @returns Ranked array of items that meet the threshold
 */
export function weightedFuzzySearch(
  keyword: string,
  items: any[],
  fieldWeights: Record<string, number>,
  threshold: number
): any[] {
  // Calculate total weight for normalization
  const totalWeight = Object.values(fieldWeights).reduce((sum, weight) => sum + weight, 0);

  // Score each item
  const scoredItems = items.map(item => {
    let weightedScore = 0;

    // Search each field individually and accumulate weighted scores
    for (const [field, weight] of Object.entries(fieldWeights)) {
      const fieldValue = item[field];
      if (fieldValue) {
        // Search just this field without threshold
        const matches = search(keyword, [fieldValue], {
          threshold: 0,
          returnMatchData: true
        });

        if (matches.length > 0) {
          // fast-fuzzy returns scores where higher is better (0-1 range)
          const fieldScore = matches[0].score;
          weightedScore += fieldScore * weight;
        }
      }
    }

    // Normalize by total weight
    const normalizedScore = weightedScore / totalWeight;

    return {
      item,
      score: normalizedScore
    };
  });

  // Filter by threshold and sort by score descending
  return scoredItems
    .filter(result => result.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .map(result => result.item);
}

/**
 * Adds a field value to the fields array with the specified weight
 * @param fields - Array to add field values to
 * @param value - The field value to add (will be checked for existence)
 * @param weight - Number of times to add the field (higher = more important)
 */
export function addFieldWithWeight(fields: string[], value: any, weight: number): void {
  if (value) {
    for (let i = 0; i < weight; i++) {
      fields.push(value);
    }
  }
}

/**
 * Calculates weighted fields for a database item
 * @param item - Database item with various fields
 * @returns Array of field values with weighting applied
 */
export function calculateWeightedFields(item: any): string[] {
  const fields: string[] = [];

  // Name is most important (3x weight)
  addFieldWithWeight(fields, item.Name, 3);

  // Type is important (2x weight)
  addFieldWithWeight(fields, item.Type, 2);

  // Descriptive fields have normal weight (1x)
  addFieldWithWeight(fields, item.Help, 1);
  addFieldWithWeight(fields, item.Description, 1);
  addFieldWithWeight(fields, item.Strategy, 1);

  // Context fields have normal weight (1x)
  addFieldWithWeight(fields, item.Branch, 1);
  addFieldWithWeight(fields, item.Era, 1);

  return fields;
}
