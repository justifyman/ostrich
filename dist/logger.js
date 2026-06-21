function write(level, message, details) {
    const suffix = details ? ` ${JSON.stringify(details)}` : "";
    const line = `${new Date().toISOString()} ${level.toUpperCase()} ${message}${suffix}`;
    if (level === "error")
        console.error(line);
    else if (level === "warn")
        console.warn(line);
    else
        console.log(line);
}
export const logger = {
    info: (message, details) => write("info", message, details),
    warn: (message, details) => write("warn", message, details),
    error: (message, details) => write("error", message, details),
};
