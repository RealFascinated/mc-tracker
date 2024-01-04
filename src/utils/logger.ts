import Winston, { format } from "winston";
const { colorize, timestamp, printf } = format;

interface LogInfo {
  level: string;
  message: string;
  label?: string;
  timestamp?: string;
}

const customFormat = format.combine(
  timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  printf((info: LogInfo) => {
    return `[${info.timestamp}] ${info.level}: ${info.message}`;
  })
);

/**
 * The global logger instance.
 */
export const logger = Winston.createLogger({
  transports: [
    new Winston.transports.Console({
      format: Winston.format.combine(colorize(), customFormat),
    }),
    new Winston.transports.File({
      filename: `data/logs/${new Date().toISOString().slice(0, 10)}.log`,
      format: Winston.format.combine(customFormat),
    }),
  ],
});
