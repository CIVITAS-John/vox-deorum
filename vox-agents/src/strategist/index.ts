import { loadConfig } from "../utils/config";
import { loadMastra } from "../utils/mastra";
import { DummyStrategist } from "./dummy";

// Load the config (this also initializes .env)
loadConfig();
loadMastra();

// Create the strategist
const strategist = DummyStrategist();
const output = await strategist.generateVNext([])
console.log(output.text);