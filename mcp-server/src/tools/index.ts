import { MCPServer } from "../server.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger('Tools');

/**
 * Tool registry to manage available tools
 */
const ToolRegistry: Map<string, (Server: MCPServer) => void> = new Map();

/**
 * Register a tool with the MCP server
 */
export function registerTool(name: string, registerFn: (Server: MCPServer) => void) {
    if (ToolRegistry.has(name)) {
        throw new Error(`Tool with name ${name} is already registered.`);
    }
    ToolRegistry.set(name, registerFn);
}

/**
 * Register all tools in the registry with the given server instance
 */
export function registerAllTools(server: MCPServer) {
    for (const [name, registerFn] of ToolRegistry) {
        registerFn(server);
        logger.info(`Registered tool: ${name}`);
    }
}