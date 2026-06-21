type Details = Record<string, unknown>;

function write(level: "info" | "warn" | "error", message: string, details?: Details): void {
  const suffix = details ? ` ${JSON.stringify(details)}` : "";
  const line = `${new Date().toISOString()} ${level.toUpperCase()} ${message}${suffix}`;

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (message: string, details?: Details) => write("info", message, details),
  warn: (message: string, details?: Details) => write("warn", message, details),
  error: (message: string, details?: Details) => write("error", message, details),
};
