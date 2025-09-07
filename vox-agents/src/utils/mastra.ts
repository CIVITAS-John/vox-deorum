import { Mastra } from "@mastra/core";
 
(globalThis as any).___MASTRA_TELEMETRY___ = true;

/**
 * Load a Mastra instance.
 */
export function loadMastra(): Mastra {
  var instance = new Mastra({
    telemetry: {
      serviceName: "vox-agents",
      enabled: true,
      sampling: {
        type: "always_on",
      }
    }
  });

  return instance;
}

/**
 * Singleton configuration instance
 */
export const mastra = loadMastra();