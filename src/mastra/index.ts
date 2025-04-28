import { Mastra } from "@mastra/core/mastra";
import { LangfuseExporter } from "langfuse-vercel";

import { CheapResearchAgent } from "./OpenCheapResearch/agents";
import { createLogger } from "@mastra/core";

const consoleLogger = createLogger(
  {
    name: "mastra",
    level: "info",
  });

// Create and export the Mastra instance
export const mastra = new Mastra({
  agents: {
    CheapResearchAgent,
  },
  telemetry: {
    serviceName: "ai",
    enabled: true,
    export: {
      type: "custom",
      exporter: new LangfuseExporter({
        publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
        secretKey: process.env.LANGFUSE_SECRET_KEY!,
        baseUrl: process.env.LANGFUSE_BASEURL!,
      }),
    },
  },
  logger: consoleLogger,
});

