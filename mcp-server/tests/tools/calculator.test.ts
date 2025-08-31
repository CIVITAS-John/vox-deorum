import { describe, it, expect } from "vitest";
import { CalculatorTool } from "../../src/tools/calculator.js";

describe("CalculatorTool", () => {
  const calculator = new CalculatorTool();

  it("should handle basic arithmetic and math operations", async () => {
    // Test that the tool properly wraps mathjs evaluate function
    const tests = [
      { expr: "2 + 3", expected: 5 },
      { expr: "10 - 4", expected: 6 },
      { expr: "6 * 7", expected: 42 },
      { expr: "15 / 3", expected: 5 },
      { expr: "2 + 3 * 4", expected: 14 }, // order of operations
      { expr: "(2 + 3) * 4", expected: 20 }, // parentheses
      { expr: "sqrt(16)", expected: 4 },
      { expr: "2^8", expected: 256 },
      { expr: "abs(-42)", expected: 42 },
      { expr: "5!", expected: 120 }
    ];

    for (const test of tests) {
      const result = await calculator.execute({ expression: test.expr });
      expect(result.expression).toBe(test.expr);
      expect(result.result).toBe(test.expected);
    }
  });

  it("should handle complex expressions and special values", async () => {
    // Test complex expressions and special math constants
    let result = await calculator.execute({ expression: "sqrt(3^2 + 4^2)" });
    expect(result.result).toBe(5);

    result = await calculator.execute({ expression: "pi * 2" });
    expect(result.result).toBeCloseTo(6.283185307);

    result = await calculator.execute({ expression: "e" });
    expect(result.result).toBeCloseTo(2.718281828);

    result = await calculator.execute({ expression: "1.5e3 + 500" });
    expect(result.result).toBe(2000);

    // Edge cases that mathjs handles specially
    result = await calculator.execute({ expression: "1 / 0" });
    expect(result.result).toBe(Infinity);

    result = await calculator.execute({ expression: "sqrt(-1)" });
    expect(result.result).toBe("i");
  });

  it("should handle non-numeric results as strings", async () => {
    // Test that non-numeric results are converted to strings
    let result = await calculator.execute({ 
      expression: "[[1, 2], [3, 4]] * [[5], [6]]" 
    });
    expect(result.result).toBe("[[17], [39]]");

    result = await calculator.execute({ 
      expression: "5 meter to cm" 
    });
    expect(result.result).toBe("500 cm");
  });

  it("should properly handle errors from mathjs", async () => {
    // Test that mathjs errors are properly caught and re-thrown
    const invalidExpressions = [
      "2 */ 3",           // syntax error
      "x + 5",            // undefined variable
      "notafunction(5)",  // unknown function
      "((2 + 3)"          // mismatched parentheses
    ];

    for (const expr of invalidExpressions) {
      await expect(
        calculator.execute({ expression: expr })
      ).rejects.toThrow();
    }
  });

  it("should maintain correct input/output schema", async () => {
    // Verify the tool follows the expected schema
    const result = await calculator.execute({ expression: "42" });
    
    // Check output structure
    expect(result).toHaveProperty("expression");
    expect(result).toHaveProperty("result");
    expect(result.expression).toBe("42");
    expect(result.result).toBe(42);

    // Verify schema types
    expect(typeof result.expression).toBe("string");
    expect(typeof result.result === "number" || typeof result.result === "string").toBe(true);
  });
});