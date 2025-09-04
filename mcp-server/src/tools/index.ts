import { ToolBase } from "./base.js";
import CalculatorTool from "./general/calculator.js";
import LuaExecutorTool from "./general/lua-executor.js";
import GetTechnologyTool from "./databases/get-technology.js";
import GetPolicyTool from "./databases/get-policy.js";

/**
 * Function to get all available tools
 */
export const allTools: ToolBase[] = [
    CalculatorTool,
    LuaExecutorTool,
    GetTechnologyTool,
    GetPolicyTool
];