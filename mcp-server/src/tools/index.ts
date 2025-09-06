import { ToolBase } from "./base.js";
import CalculatorTool from "./general/calculator.js";
import LuaExecutorTool from "./general/lua-executor.js";
import GetTechnologyTool from "./databases/get-technology.js";
import GetPolicyTool from "./databases/get-policy.js";
import GetBuildingTool from "./databases/get-building.js";
import GetEventsTool from "./knowledge/get-events.js";
import SetStrategyTool from "./actions/set-strategy.js";

/**
 * Function to get all available tools
 */
export const allTools: ToolBase[] = [
    CalculatorTool,
    LuaExecutorTool,
    GetTechnologyTool,
    GetPolicyTool,
    GetBuildingTool,
    GetEventsTool,
    SetStrategyTool
];