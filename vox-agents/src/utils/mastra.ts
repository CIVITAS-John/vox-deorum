import { Mastra } from "@mastra/core";

/**
 * Load a Mastra instance.
 */
export function loadMastra(): Mastra {
  return new Mastra({
    telemetry: {
      serviceName: "vox-agents",
      enabled: true,
      sampling: {
        type: "always_on",
      },
      export: {
        type: "otlp",
        endpoint: "http://localhost:4318"
      }
    }
  })
}

/**
 * Singleton configuration instance
 */
export const mastra = loadMastra();