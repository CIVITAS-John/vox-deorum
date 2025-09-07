import { loadConfig } from "../utils/config.js";
import { mcpClient } from "../utils/mcp-client.js";
import { DummyStrategist } from "./dummy.js";

// Load the config (this also initializes .env)
loadConfig();

// Connect to the MCP server
await mcpClient.connect();

// Create the strategist
const strategist = DummyStrategist();
const tools = await mcpClient.getTools("strategist");
console.log(tools);
const output = await strategist.generateVNext([])
console.log(output.text);