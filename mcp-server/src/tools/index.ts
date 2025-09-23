import createCalculatorTool from "./general/calculator.js";
import createLuaExecutorTool from "./general/lua-executor.js";
import createGetTechnologyTool from "./databases/get-technology.js";
import createGetPolicyTool from "./databases/get-policy.js";
import createGetBuildingTool from "./databases/get-building.js";
import createGetCivilizationTool from "./databases/get-civilization.js";
import createGetUnitTool from "./databases/get-unit.js";
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

// Tool factory configuration - one line per tool
const toolFactories = {
    calculator: createCalculatorTool,
    luaExecutor: createLuaExecutorTool,
    getTechnology: createGetTechnologyTool,
    getPolicy: createGetPolicyTool,
    getBuilding: createGetBuildingTool,
    getCivilization: createGetCivilizationTool,
    getUnit: createGetUnitTool,
    getEvents: createGetEventsTool,
    getPlayers: createGetPlayersTool,
    getOpinions: createGetOpinionsTool,
    getCities: createGetCitiesTool,
    getMetadata: createGetMetadataTool,
    setMetadata: createSetMetadataTool,
    summarizeUnits: createSummarizeUnitsTool,
    setStrategy: createSetStrategyTool,
    setPersona: createSetPersonaTool,
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