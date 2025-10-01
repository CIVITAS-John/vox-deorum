import createCalculatorTool from "./general/calculator.js";
import createLuaExecutorTool from "./general/lua-executor.js";
import createGetTechnologyTool from "./databases/get-technology.js";
import createGetPolicyTool from "./databases/get-policy.js";
import createGetBuildingTool from "./databases/get-building.js";
import createGetCivilizationTool from "./databases/get-civilization.js";
import createGetUnitTool from "./databases/get-unit.js";
import createGetEconomicStrategiesTool from "./databases/get-economic-strategies.js";
import createGetMilitaryStrategiesTool from "./databases/get-military-strategies.js";
import createGetEventsTool from "./knowledge/get-events.js";
import createGetPlayersTool from "./knowledge/get-players.js";
import createGetOpinionsTool from "./knowledge/get-opinions.js";
import createGetCitiesTool from "./knowledge/get-cities.js";
import createGetMetadataTool from "./knowledge/get-metadata.js";
import createSetStrategyTool from "./actions/set-strategy.js";
import createSetPersonaTool from "./actions/set-persona.js";
import createPauseGameTool from "./actions/pause-game.js";
import createResumeGameTool from "./actions/resume-game.js";
import createSummarizeUnitsTool from "./knowledge/summarize-units.js";
import createSetMetadataTool from "./actions/set-metadata.js";
import createKeepStatusQuoTool from "./actions/keep-status-quo.js";
import createGetOptionsTool from "./knowledge/get-options.js";
import createSetResearchTool from "./actions/set-research.js";
import createSetPolicyTool from "./actions/set-policy.js";

// Tool factory configuration - one line per tool
const toolFactories = {
    calculator: createCalculatorTool,
    luaExecutor: createLuaExecutorTool,
    getTechnology: createGetTechnologyTool,
    getPolicy: createGetPolicyTool,
    getBuilding: createGetBuildingTool,
    getCivilization: createGetCivilizationTool,
    getUnit: createGetUnitTool,
    getEconomicStrategies: createGetEconomicStrategiesTool,
    getMilitaryStrategies: createGetMilitaryStrategiesTool,
    getEvents: createGetEventsTool,
    getPlayers: createGetPlayersTool,
    getOpinions: createGetOpinionsTool,
    getCities: createGetCitiesTool,
    getMetadata: createGetMetadataTool,
    setMetadata: createSetMetadataTool,
    summarizeUnits: createSummarizeUnitsTool,
    getOptions: createGetOptionsTool,
    setStrategy: createSetStrategyTool,
    setPersona: createSetPersonaTool,
    setResearch: createSetResearchTool,
    setPolicy: createSetPolicyTool,
    keepStatusQuo: createKeepStatusQuoTool,
    pauseGame: createPauseGameTool,
    resumeGame: createResumeGameTool,
} as const;
 
// Type for the tools object (inferred from factories)
type Tools = { [K in keyof typeof toolFactories]: ReturnType<typeof toolFactories[K]> };

// Cache for tool instances
let toolsCache: Tools | null = null;

/**
 * Function to get all available tool instances as an object
 * Creates and caches instances on first call, returns cached instances on subsequent calls
 * @returns Object containing cached tool instances with preserved type information
 */
export const getTools = (): Tools => {
    if (!toolsCache) {
        toolsCache = Object.fromEntries(
            Object.entries(toolFactories).map(([key, factory]) => [key, factory()])
        ) as Tools;
    }
    return toolsCache;
};

/**
 * Function to get a specific tool instance by name
 * Creates and caches instances on first call, returns cached instance on subsequent calls
 * @param name The name of the tool to retrieve
 * @returns The tool instance, or undefined if the tool doesn't exist
 */
export const getTool = <K extends keyof typeof toolFactories>(
    name: K
): ReturnType<typeof toolFactories[K]> | undefined => {
    const tools = getTools();
    return tools[name];
};