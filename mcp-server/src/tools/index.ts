import { ToolBase } from "./base.js";
import CalculatorTool from "./general/calculator.js";
import LuaExecutorTool from "./general/lua-executor.js";

/**
 * Function to get all available tools
 */
export const allTools: ToolBase[] = [
    CalculatorTool,
    LuaExecutorTool
];