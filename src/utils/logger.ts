type LogLevel = "debug" | "info" | "warn" | "error";

const levelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const configuredLevel = (process.env.LOG_LEVEL as LogLevel | undefined) ?? "info";

const shouldLog = (level: LogLevel): boolean =>
  levelOrder[level] >= levelOrder[configuredLevel];

const writeLog = (
  level: LogLevel,
  message: string,
  context: Record<string, unknown> = {},
): void => {
  if (!shouldLog(level)) {
    return;
  }

  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    app: process.env.APP_NAME ?? "telegram-bot-analytics-backend",
    ...context,
  };

  console.log(JSON.stringify(payload));
};

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) =>
    writeLog("debug", message, context),
  info: (message: string, context?: Record<string, unknown>) =>
    writeLog("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) =>
    writeLog("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) =>
    writeLog("error", message, context),
};
