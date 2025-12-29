import Winston, { format } from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
const { colorize, timestamp, printf } = format;

const customFormat = format.combine(
  timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  printf((info) => {
    return `[${info.timestamp}] ${info.level}: ${String(info.message)}`;
  }),
);

/**
 * The global logger instance.
 */
export const logger = Winston.createLogger({
  transports: [
    new Winston.transports.Console({
      format: Winston.format.combine(colorize(), customFormat),
    }),
    new DailyRotateFile({
      filename: "data/logs/%DATE%.log",
      datePattern: "YYYY-MM-DD",
      format: Winston.format.combine(customFormat),
      maxFiles: 3, // Keep last 3 files
      maxSize: "5m", // 5MB
      zippedArchive: true,
    }),
  ],
});
