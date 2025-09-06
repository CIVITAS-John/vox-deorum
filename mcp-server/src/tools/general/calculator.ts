import { ToolBase } from "../base.js";
import * as z from "zod";
import { evaluate } from "mathjs";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

/**
 * Calculator tool that wraps mathjs for mathematical operations
 */
class CalculatorTool extends ToolBase {
  /**
   * Unique identifier for the calculator tool
   */
  readonly name = "calculator";

  /**
   * Human-readable description of the calculator tool
   */
  readonly description = "Evaluates mathematical expressions using mathjs library";

  /**
   * Input schema defining the expression to evaluate
   */
  readonly inputSchema = z.object({
    Expression: z.string().describe("Mathematical expression to evaluate")
  });

  /**
   * Output schema for calculation results
   */
  readonly outputSchema = z.object({
    Result: z.union([z.number(), z.string()])
  });

  /**
   * Optional annotations for the calculator tool
   */
  readonly annotations: ToolAnnotations = {
    audience: ["user", "assistant"]
  }

  /**
   * Execute the calculator operation using mathjs
   */
  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    const result = evaluate(args.Expression);
    
    return {
      Result: typeof result === 'number' ? result : String(result)
    };
  }
}

/**
 * Creates a new instance of the calculator tool
 */
export default function createCalculatorTool() {
  return new CalculatorTool();
}