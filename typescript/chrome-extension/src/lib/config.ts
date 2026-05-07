import { buildDefaults } from "./build-config.generated.js";

export type LlmProvider = "openai" | "anthropic" | "mistral";

export interface ExtensionSettings {
  routestack: {
    apiKey: string;
    apiSecret: string;
    mcpUrl: string;
  };
  llm: {
    provider: LlmProvider;
    openai: {
      apiKey: string;
      model: string;
    };
    anthropic: {
      apiKey: string;
      model: string;
    };
    mistral: {
      apiKey: string;
      model: string;
      baseUrl: string;
    };
  };
}

const defaults: ExtensionSettings = {
  routestack: {
    apiKey: buildDefaults.routestack.apiKey,
    apiSecret: buildDefaults.routestack.apiSecret,
    mcpUrl: buildDefaults.routestack.mcpUrl,
  },
  llm: {
    provider: normalizeProvider(buildDefaults.llm.provider),
    openai: {
      apiKey: buildDefaults.llm.openai.apiKey,
      model: buildDefaults.llm.openai.model,
    },
    anthropic: {
      apiKey: buildDefaults.llm.anthropic.apiKey,
      model: buildDefaults.llm.anthropic.model,
    },
    mistral: {
      apiKey: buildDefaults.llm.mistral.apiKey,
      model: buildDefaults.llm.mistral.model,
      baseUrl: buildDefaults.llm.mistral.baseUrl,
    },
  },
};

export async function getSettings(): Promise<ExtensionSettings> {
  const stored = await chrome.storage.local.get("routestack_settings");
  return mergeSettings(defaults, stored.routestack_settings as Partial<ExtensionSettings> | undefined);
}

export async function saveSettings(settings: Partial<ExtensionSettings>): Promise<ExtensionSettings> {
  const merged = mergeSettings(await getSettings(), settings);
  await chrome.storage.local.set({ routestack_settings: merged });
  return merged;
}

export function getProviderApiKey(settings: ExtensionSettings): string {
  if (settings.llm.provider === "anthropic") return settings.llm.anthropic.apiKey;
  if (settings.llm.provider === "mistral") return settings.llm.mistral.apiKey;
  return settings.llm.openai.apiKey;
}

export function validateSettings(settings: ExtensionSettings): string[] {
  const issues: string[] = [];

  if (!settings.routestack.apiKey) issues.push("RouteStack API key is missing.");
  if (!settings.routestack.mcpUrl) issues.push("RouteStack MCP URL is missing.");
  if (!getProviderApiKey(settings)) {
    issues.push(`The ${settings.llm.provider} API key is missing.`);
  }

  return issues;
}

function mergeSettings(
  base: ExtensionSettings,
  incoming?: Partial<ExtensionSettings>,
): ExtensionSettings {
  return {
    routestack: {
      apiKey: incoming?.routestack?.apiKey ?? base.routestack.apiKey,
      apiSecret: incoming?.routestack?.apiSecret ?? base.routestack.apiSecret,
      mcpUrl: incoming?.routestack?.mcpUrl ?? base.routestack.mcpUrl,
    },
    llm: {
      provider: normalizeProvider(incoming?.llm?.provider ?? base.llm.provider),
      openai: {
        apiKey: incoming?.llm?.openai?.apiKey ?? base.llm.openai.apiKey,
        model: incoming?.llm?.openai?.model ?? base.llm.openai.model,
      },
      anthropic: {
        apiKey: incoming?.llm?.anthropic?.apiKey ?? base.llm.anthropic.apiKey,
        model: incoming?.llm?.anthropic?.model ?? base.llm.anthropic.model,
      },
      mistral: {
        apiKey: incoming?.llm?.mistral?.apiKey ?? base.llm.mistral.apiKey,
        model: incoming?.llm?.mistral?.model ?? base.llm.mistral.model,
        baseUrl: incoming?.llm?.mistral?.baseUrl ?? base.llm.mistral.baseUrl,
      },
    },
  };
}

function normalizeProvider(value: string): LlmProvider {
  if (value === "anthropic" || value === "mistral") return value;
  return "openai";
}

