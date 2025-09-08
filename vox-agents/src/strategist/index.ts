import { loadConfig } from "../utils/config.js";
import { mcpClient } from "../utils/mcp-client.js";
import { DummyStrategist } from "./dummy.js";

// Load the config (this also initializes .env)
loadConfig();

// Connect to the MCP server
await mcpClient.connect();

// Create the strategist
const strategist = await DummyStrategist();
console.log(strategist);