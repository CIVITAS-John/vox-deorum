import { Mastra } from "@mastra/core";
import { LangfuseExporter } from '@mastra/langfuse';

/**
 * Load a Mastra instance.
 */
function loadMastra(): Mastra {
  var instance = new Mastra({
    observability: {
      instances: {
        langfuse: {
          serviceName: 'my-service',
          exporters: [
            new LangfuseExporter({
              publicKey: process.env.LANGFUSE_PUBLIC_KEY,
              secretKey: process.env.LANGFUSE_SECRET_KEY,
              baseUrl: process.env.LANGFUSE_BASE_URL,
              realtime: true,
            }),
          ],
        },
      },
    },
  });

  return instance;
}

/**
 * Singleton configuration instance
 */
export const mastra = loadMastra();