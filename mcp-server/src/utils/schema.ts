/**
 * Utility for sorting object properties based on Zod schema key order
 * Ensures JSON output follows schema property order with dynamic keys sorted alphabetically
 */

import * as z from "zod";

/**
 * Sort object keys to match Zod schema order, with remaining keys alphabetically
 *
 * This function extracts the keys from a Zod object schema and reorders the data object
 * so that schema-defined keys appear first (in schema definition order), followed by
 * any additional keys sorted alphabetically.
 *
 * @param data - The object to sort
 * @param schema - The Zod object schema defining the expected key order
 * @returns A new object with keys sorted according to schema order
 *
 * @example
 * ```typescript
 * const schema = z.object({
 *   Name: z.string(),
 *   Score: z.number()
 * }).passthrough();
 *
 * const data = { PlayerA: 100, Score: 50, PlayerB: 200, Name: "Test" };
 * const sorted = sortBySchema(data, schema);
 * // Result: { Name: "Test", Score: 50, PlayerA: 100, PlayerB: 200 }
 * ```
 */
export function sortBySchema<T extends Record<string, any>>(
  data: T,
  schema: z.ZodObject<any, any>
): T {
  // Extract schema keys using Zod's keyof() method
  const schemaKeys = [...schema.keyof().options] as string[];

  // Get all keys from the data object
  const allKeys = Object.keys(data);

  // Separate schema keys (in schema order) and dynamic keys (alphabetically sorted)
  const orderedSchemaKeys = schemaKeys.filter(key => key in data);
  const dynamicKeys = allKeys
    .filter(key => !schemaKeys.includes(key))
    .sort();

  // Build sorted object with schema keys first, then dynamic keys
  const sorted = {} as T;

  for (const key of orderedSchemaKeys) {
    sorted[key as keyof T] = data[key as keyof T];
  }

  for (const key of dynamicKeys) {
    sorted[key as keyof T] = data[key as keyof T];
  }

  return sorted;
}
