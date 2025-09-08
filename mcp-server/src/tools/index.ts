import { ToolBase } from "./base.js";
import createCalculatorTool from "./general/calculator.js";
import createLuaExecutorTool from "./general/lua-executor.js";
import createGetTechnologyTool from "./databases/get-technology.js";
import createGetPolicyTool from "./databases/get-policy.js";
import createGetBuildingTool from "./databases/get-building.js";
import createGetCivilizationTool from "./databases/get-civilization.js";
import createGetEventsTool from "./knowledge/get-events.js";
import createSetStrategyTool from "./actions/set-strategy.js";

/**
 * Function to get all available tools
 * @returns Array of functions that create tool instances
 */
export const allTools: (() => ToolBase)[] = [
    createCalculatorTool,
    createLuaExecutorTool,
    createGetTechnologyTool,
    createGetPolicyTool,
    createGetBuildingTool,
    createGetCivilizationTool,
    createGetEventsTool,
    createSetStrategyTool
];