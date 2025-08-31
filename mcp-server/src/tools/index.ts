import { ToolBase } from "./base.js";
import { CalculatorTool } from "./calculator.js";

/**
 * Function to get all available tools
 */
export function getAllTools(): ToolBase[] {
    return [
        new CalculatorTool()
    ];
}