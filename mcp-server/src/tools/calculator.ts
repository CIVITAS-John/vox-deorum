import { ToolBase } from "./base.js";
import * as z from "zod";
import { evaluate } from "mathjs";

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
    expression: z.string().describe("Mathematical expression to evaluate (e.g., '2 + 3 * 4', 'sqrt(16)', 'sin(pi/2)')")
  });

  /**
   * Output schema for calculation results
   */
  readonly outputSchema = z.object({
    result: z.union([z.number(), z.string()])
  });

  /**
   * Optional annotations for the calculator tool
   */
  readonly annotations = undefined;

  /**
   * Execute the calculator operation using mathjs
   */
  async execute(args: z.infer<typeof this.inputSchema>): Promise<z.infer<typeof this.outputSchema>> {
    const result = evaluate(args.expression);
    
    return {
      result: typeof result === 'number' ? result : String(result)
    };
  }
}

export default new CalculatorTool();