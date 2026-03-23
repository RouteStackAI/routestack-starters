import chalk from "chalk";

export function formatToolCall(
  name: string,
  args: Record<string, unknown>,
): string {
  const argsStr = Object.entries(args)
    .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join(", ");
  return chalk.dim(`  -> ${name}(${argsStr})`);
}

export function formatAssistant(text: string): string {
  return chalk.white(text);
}

export function formatError(message: string): string {
  return chalk.red(`Error: ${message}`);
}

export function formatConnected(toolCount: number, mcpUrl: string): string {
  return chalk.green(`Connected to ${mcpUrl} — ${toolCount} tool${toolCount === 1 ? "" : "s"} available`);
}
