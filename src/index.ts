import { OstrichBot } from "./bot.js";
import { loadConfig } from "./config.js";
import { logger } from "./logger.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const bot = new OstrichBot(config);

  const shutdown = (signal: string) => {
    logger.info("received shutdown signal", { signal });
    bot.stop();
    process.exit(0);
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));

  bot.start();
}

main().catch((error) => {
  logger.error("ostrich failed to start", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
