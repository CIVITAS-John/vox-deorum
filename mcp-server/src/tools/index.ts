import { ToolBase } from "./base.js";
import CalculatorTool from "./calculator.js";
import LuaExecutorTool from "./lua-executor.js";

/**
 * Function to get all available tools
 */
export const allTools: ToolBase[] = [
    CalculatorTool,
    LuaExecutorTool
];