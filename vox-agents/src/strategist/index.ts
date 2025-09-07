import { loadConfig } from "../utils/config.js";
import { DummyStrategist } from "./dummy.js";

// Load the config (this also initializes .env)
loadConfig();

// Create the strategist
const strategist = DummyStrategist();
const output = await strategist.generateVNext([])
console.log(output.text);