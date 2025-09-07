import { loadConfig } from "../utils/config.js";
import { loadMastra } from "../utils/mastra.js";
import { DummyStrategist } from "./dummy.js";

// Load the config (this also initializes .env)
loadConfig();
loadMastra();

// Create the strategist
const strategist = DummyStrategist();
const output = await strategist.generateVNext([])
console.log(output.text);