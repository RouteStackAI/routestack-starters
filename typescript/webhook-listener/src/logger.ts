import chalk from "chalk";
import { config } from "./config.js";

type LogLevel = "debug" | "info" | "warn" | "error";

const levelPriority: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function shouldLog(level: LogLevel): boolean {
  return levelPriority[level] >= levelPriority[config.logLevel];
}

function stamp(): string {
  return new Date().toISOString();
}

export function logDebug(message: string): void {
  if (!shouldLog("debug")) return;
  console.log(chalk.gray(`[${stamp()}] DEBUG ${message}`));
}

export function logInfo(message: string): void {
  if (!shouldLog("info")) return;
  console.log(chalk.cyan(`[${stamp()}] INFO  ${message}`));
}

export function logWarn(message: string): void {
  if (!shouldLog("warn")) return;
  console.log(chalk.yellow(`[${stamp()}] WARN  ${message}`));
}

export function logError(message: string): void {
  if (!shouldLog("error")) return;
  console.error(chalk.red(`[${stamp()}] ERROR ${message}`));
}
