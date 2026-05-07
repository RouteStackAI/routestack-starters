import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");
const env = await loadEnv(path.join(rootDir, ".env"));

await writeFile(
  path.join(rootDir, "src", "lib", "build-config.generated.ts"),
  [
    "export const buildDefaults = {",
    `  routestack: { apiKey: ${JSON.stringify(env.ROUTESTACK_API_KEY ?? "")}, apiSecret: ${JSON.stringify(env.ROUTESTACK_API_SECRET ?? "")}, mcpUrl: ${JSON.stringify(env.ROUTESTACK_MCP_URL ?? "https://mcp.routestack.ai/sse")} },`,
    "  llm: {",
    `    provider: ${JSON.stringify(env.LLM_PROVIDER ?? "openai")},`,
    `    openai: { apiKey: ${JSON.stringify(env.OPENAI_API_KEY ?? "")}, model: ${JSON.stringify(env.OPENAI_MODEL ?? "gpt-4o")} },`,
    `    anthropic: { apiKey: ${JSON.stringify(env.ANTHROPIC_API_KEY ?? "")}, model: ${JSON.stringify(env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5-latest")} },`,
    `    mistral: { apiKey: ${JSON.stringify(env.MISTRAL_API_KEY ?? "")}, model: ${JSON.stringify(env.MISTRAL_MODEL ?? "mistral-large-latest")}, baseUrl: ${JSON.stringify(env.MISTRAL_BASE_URL ?? "https://api.mistral.ai/v1")} },`,
    "  },",
    "} as const;",
    "",
  ].join("\n"),
);

await cleanOutput([
  path.join(distDir, "background"),
  path.join(distDir, "content"),
  path.join(distDir, "lib"),
  path.join(distDir, "sidepanel"),
  path.join(distDir, "icons"),
  path.join(distDir, "manifest.json"),
]);

await mkdir(path.join(distDir, "background"), { recursive: true });
await mkdir(path.join(distDir, "content"), { recursive: true });
await mkdir(path.join(distDir, "sidepanel"), { recursive: true });
await mkdir(path.join(distDir, "icons"), { recursive: true });

await cp(
  path.join(rootDir, "src", "icons"),
  path.join(distDir, "icons"),
  { recursive: true },
);

await build({
  entryPoints: {
    "background/service-worker": path.join(rootDir, "src", "background", "service-worker.ts"),
    "content/extractor": path.join(rootDir, "src", "content", "extractor.ts"),
    "sidepanel/panel": path.join(rootDir, "src", "sidepanel", "panel.ts"),
  },
  outdir: distDir,
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["chrome114"],
  sourcemap: "inline",
  logLevel: "info",
  legalComments: "none",
});

await writeFile(
  path.join(distDir, "sidepanel", "index.html"),
  await readFile(path.join(rootDir, "src", "sidepanel", "index.html"), "utf8"),
);
await writeFile(
  path.join(distDir, "sidepanel", "styles.css"),
  await readFile(path.join(rootDir, "src", "sidepanel", "styles.css"), "utf8"),
);
await writeFile(
  path.join(distDir, "manifest.json"),
  await readFile(path.join(rootDir, "manifest.json"), "utf8"),
);

async function loadEnv(filePath) {
  try {
    const source = await readFile(filePath, "utf8");
    return Object.fromEntries(
      source
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
        .map((line) => {
          const equalsIndex = line.indexOf("=");
          if (equalsIndex < 0) return [line, ""];
          const key = line.slice(0, equalsIndex).trim();
          const rawValue = line.slice(equalsIndex + 1).trim();
          const value = rawValue.replace(/^['"]|['"]$/g, "");
          return [key, value];
        }),
    );
  } catch {
    return {};
  }
}

async function cleanOutput(paths) {
  for (const targetPath of paths) {
    try {
      await rm(targetPath, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup. Chrome may keep old dist files locked while the
      // unpacked extension is active, so builds should still proceed.
    }
  }
}
