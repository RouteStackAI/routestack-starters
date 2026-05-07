import { getSettings, saveSettings, validateSettings } from "../lib/config.js";
import { connectMcp, disconnectMcp, listTools } from "../lib/mcp-client.js";
import { runTravelAgent, type ToolExecutionContext } from "../lib/llm.js";
import type {
  ChatResponsePayload,
  Message,
  PageContext,
  PanelRequest,
  PanelResponse,
} from "../lib/types.js";

const conversationByTab = new Map<
  number,
  { messages: Message[]; context: ToolExecutionContext }
>();

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.runtime.onMessage.addListener((
  request: PanelRequest,
  _sender: unknown,
  sendResponse: (response: PanelResponse) => void,
) => {
  void handlePanelRequest(request)
    .then(sendResponse)
    .catch(async (error: unknown) => {
      const settings = await getSettings().catch(() => undefined);
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        settings,
      } satisfies PanelResponse);
    });

  return true;
});

async function handlePanelRequest(request: PanelRequest): Promise<PanelResponse> {
  if (request.type === "ROUTESTACK_SAVE_SETTINGS") {
    const settings = await saveSettings(request.settings);
    return {
      ok: true,
      settings,
      payload: {
        assistantMessage: "Settings saved.",
        resultSections: [],
        toolCalls: [],
        pageContext: null,
        settingsIssues: validateSettings(settings),
      },
    };
  }

  if (request.type === "ROUTESTACK_RESET") {
    conversationByTab.delete(request.tabId);
    const settings = await getSettings();
    return {
      ok: true,
      settings,
      payload: {
        assistantMessage: "Conversation cleared.",
        resultSections: [],
        toolCalls: [],
        pageContext: await getPageContext(request.tabId),
        settingsIssues: validateSettings(settings),
      },
    };
  }

  if (request.type === "ROUTESTACK_BOOTSTRAP") {
    const settings = await getSettings();
    return {
      ok: true,
      settings,
      payload: {
        assistantMessage: "RouteStack is ready.",
        resultSections: [],
        toolCalls: [],
        pageContext: await getPageContext(request.tabId),
        settingsIssues: validateSettings(settings),
      },
    };
  }

  const settings = await getSettings();
  const settingsIssues = validateSettings(settings);
  if (settingsIssues.length) {
    return {
      ok: true,
      settings,
      payload: {
        assistantMessage: "Add your API credentials in Settings to start searching live inventory.",
        resultSections: [],
        toolCalls: [],
        pageContext: await getPageContext(request.tabId),
        settingsIssues,
      },
    };
  }

  const pageContext = await getPageContext(request.tabId);
  const state = getOrCreateConversation(request.tabId);
  state.messages.push({
    role: "user",
    content: buildUserPrompt(request.prompt, request.searchMode, pageContext),
  });

  console.info("[RouteStack] incoming search", {
    tabId: request.tabId,
    searchMode: request.searchMode,
    prompt: request.prompt,
    pageContext,
  });

  let result;
  try {
    await connectMcp();
    const tools = await listTools();
    console.info("[RouteStack] MCP tools available", tools.map((tool) => tool.name));
    result = await runTravelAgent(state.messages, tools, pageContext, state.context);
  } finally {
    await disconnectMcp();
  }

  state.messages = result.messages;

  const payload: ChatResponsePayload = {
    assistantMessage: result.response,
    resultSections: result.resultSections,
    toolCalls: result.toolCalls,
    pageContext,
    settingsIssues: [],
  };

  return {
    ok: true,
    payload,
    settings,
  };
}

function getOrCreateConversation(tabId: number) {
  const existing = conversationByTab.get(tabId);
  if (existing) return existing;

  const created = {
    messages: [] as Message[],
    context: {
      hotel: {},
      flight: {},
      generic: {
        recentSummaries: [],
      },
    } satisfies ToolExecutionContext,
  };

  conversationByTab.set(tabId, created);
  return created;
}

function buildUserPrompt(
  prompt: string,
  searchMode: "hotels" | "flights" | "cars",
  pageContext: PageContext | null,
) {
  const contextSummary = pageContext
    ? `Page title: ${pageContext.title}\nTravel hints: ${pageContext.travelHints.join("; ") || "none"}`
    : "No page context available.";

  return [`Search mode: ${searchMode}`, `User request: ${prompt}`, contextSummary].join("\n");
}

async function getPageContext(tabId: number): Promise<PageContext | null> {
  try {
    return (await chrome.tabs.sendMessage(tabId, {
      type: "ROUTESTACK_EXTRACT_CONTEXT",
    })) as PageContext;
  } catch {
    return null;
  }
}
