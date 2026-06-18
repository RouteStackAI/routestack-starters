import { saveSettings, type ExtensionSettings } from "../lib/config.js";
import type { PanelRequest, PanelResponse, ResultItem, ResultSection } from "../lib/types.js";

const appRoot = document.querySelector<HTMLDivElement>("#app");

if (!appRoot) {
  throw new Error("RouteStack side panel root was not found.");
}

const app = appRoot;

const state = {
  tabId: 0,
  loading: false,
  searchMode: "hotels" as "hotels" | "flights" | "cars",
  settingsOpen: false,
  diagnosticsOpen: false,
  assistantMessage: "",
  pageSummary: "",
  promptDraft: "",
  resultSections: [] as ResultSection[],
  toolCalls: [] as Array<{ name: string; summary: string }>,
  settingsIssues: [] as string[],
  settings: null as ExtensionSettings | null,
  pageContext: null as Extract<PanelResponse, { ok: true }>["payload"]["pageContext"],
};

void bootstrap();

async function bootstrap() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  state.tabId = tab?.id ?? 0;

  const response = await sendRequest({
    type: "ROUTESTACK_BOOTSTRAP",
    tabId: state.tabId,
  });

  if (response.ok) {
    applyPayload(response);
  } else {
    state.assistantMessage = response.error;
    state.settings = response.settings ?? null;
  }

  render();
}

function render() {
  app.innerHTML = `
    <div class="shell">
      <div class="content-area">
        <section class="hero">
          <div>
            <p class="eyebrow">RouteStack.ai</p>
            <h1>Travel planning that stays in the flow of the page.</h1>
            <p class="lede">Search hotels, flights, and rental cars without leaving what you are already reading.</p>
          </div>
          <div class="hero-actions">
            <button class="ghost" id="settings-toggle">${state.settingsOpen ? "Close settings" : "Settings"}</button>
            <button class="ghost" id="reset-btn" ${state.loading ? "disabled" : ""}>Reset</button>
          </div>
        </section>

        ${renderSettings()}

        <section class="feed-card">
          <div class="feed-head">
            <div>
              <p class="eyebrow">Assistant</p>
              <h2>Your travel desk</h2>
            </div>
            ${renderDiagnosticsToggle()}
          </div>

          ${state.pageSummary ? `<div class="context-chip">${icon("context")}${escapeHtml(state.pageSummary)}</div>` : ""}

          <div class="assistant-bubble ${state.loading ? "assistant-bubble-live" : ""}">
            <div class="bubble-icon">${icon("spark")}</div>
            <div>
              <p class="bubble-title">${state.loading ? "Working on it" : "Latest update"}</p>
              <div class="bubble-copy markdown-body">${renderRichText(state.assistantMessage || "Start with a travel request and I'll turn it into bookable options.")}</div>
            </div>
          </div>

          ${renderDiagnostics()}
          ${renderUnifiedResults()}
        </section>
      </div>

      <section class="composer-dock">
        <div class="composer-card">
          <div class="mode-row">
            ${["hotels", "flights", "cars"]
              .map(
                (mode) => `
                  <button class="pill ${state.searchMode === mode ? "pill-active" : ""}" data-mode="${mode}">
                    ${icon(mode)}${capitalize(mode)}
                  </button>
                `,
              )
              .join("")}
          </div>
          <textarea id="prompt" rows="3" placeholder="Find refundable hotels in Austin for June 14-16 for 2 adults, or ask for the best nonstop flight from Denver.">${escapeHtml(state.promptDraft)}</textarea>
          <div class="composer-footer">
            <div class="composer-hint">${state.loading ? "Searching live inventory..." : "Ask naturally. You can also say book the best option."}</div>
            <button class="primary" id="search-btn" ${state.loading ? "disabled" : ""}>
              ${icon("send")}
              ${state.loading ? "Searching..." : "Search live inventory"}
            </button>
          </div>
          ${state.settingsIssues.length ? `<div class="warning">${state.settingsIssues.join(" ")}</div>` : ""}
        </div>
      </section>
    </div>
  `;

  wireEvents();
}

function renderSettings() {
  if (!state.settingsOpen || !state.settings) return "";

  return `
    <section class="settings-card">
      <div class="section-head">
        <h2>Settings</h2>
        <span class="badge">Stored locally</span>
      </div>
      <div class="field-grid">
        <label>
          <span>RouteStack API key</span>
          <input id="routestack-api-key" value="${escapeAttribute(state.settings.routestack.apiKey)}" />
        </label>
        <label>
          <span>RouteStack API secret</span>
          <input id="routestack-api-secret" value="${escapeAttribute(state.settings.routestack.apiSecret)}" />
        </label>
        <label>
          <span>MCP URL</span>
          <input id="routestack-mcp-url" value="${escapeAttribute(state.settings.routestack.mcpUrl)}" />
        </label>
        <label>
          <span>LLM provider</span>
          <select id="llm-provider">
            ${["openai", "anthropic", "mistral"]
              .map(
                (provider) =>
                  `<option value="${provider}" ${state.settings?.llm.provider === provider ? "selected" : ""}>${provider}</option>`,
              )
              .join("")}
          </select>
        </label>
        <label>
          <span>OpenAI key</span>
          <input id="openai-api-key" value="${escapeAttribute(state.settings.llm.openai.apiKey)}" />
        </label>
        <label>
          <span>OpenAI model</span>
          <input id="openai-model" value="${escapeAttribute(state.settings.llm.openai.model)}" />
        </label>
        <label>
          <span>Anthropic key</span>
          <input id="anthropic-api-key" value="${escapeAttribute(state.settings.llm.anthropic.apiKey)}" />
        </label>
        <label>
          <span>Anthropic model</span>
          <input id="anthropic-model" value="${escapeAttribute(state.settings.llm.anthropic.model)}" />
        </label>
        <label>
          <span>Mistral key</span>
          <input id="mistral-api-key" value="${escapeAttribute(state.settings.llm.mistral.apiKey)}" />
        </label>
        <label>
          <span>Mistral model</span>
          <input id="mistral-model" value="${escapeAttribute(state.settings.llm.mistral.model)}" />
        </label>
        <label>
          <span>Mistral base URL</span>
          <input id="mistral-base-url" value="${escapeAttribute(state.settings.llm.mistral.baseUrl)}" />
        </label>
      </div>
      <div class="action-row">
        <button class="primary" id="save-settings-btn">${icon("save")}Save settings</button>
      </div>
    </section>
  `;
}

function renderDiagnosticsToggle() {
  if (!state.toolCalls.length) return "";

  return `
    <button class="ghost ghost-compact" id="diagnostics-toggle">
      ${icon("trace")}
      ${state.diagnosticsOpen ? "Hide trace" : `Trace (${state.toolCalls.length})`}
    </button>
  `;
}

function renderDiagnostics() {
  if (!state.toolCalls.length || !state.diagnosticsOpen) return "";

  return `
    <section class="trace-card">
      <div class="trace-list">
        ${state.toolCalls
          .map(
            (toolCall) => `
              <div class="trace-row">
                <strong>${escapeHtml(toolCall.name)}</strong>
                <span>${escapeHtml(toolCall.summary)}</span>
              </div>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderUnifiedResults() {
  if (!state.resultSections.length) {
    return `
      <section class="results-stream empty-state">
        <div class="empty-illustration">${icon("empty")}</div>
        <h3>Results will land here</h3>
        <p>Once the assistant finds live inventory, you'll get options you can open or use as the next step in the conversation.</p>
      </section>
    `;
  }

  return `
    <section class="results-stream">
      ${state.resultSections
        .map(
          (section) => `
            <div class="result-group">
              <div class="section-head">
                <h3>${icon(section.kind)}${escapeHtml(section.title)}</h3>
                <span class="badge badge-${section.kind}">${section.items.length} options</span>
              </div>
              <div class="result-grid">
                ${section.items.map((item) => renderResultCard(item, section)).join("")}
              </div>
            </div>
          `,
        )
        .join("")}
    </section>
  `;
}

function renderResultCard(item: ResultItem, section: ResultSection) {
  const followUp = buildFollowUp(item, section);
  const rootTag = item.ctaUrl ? "a" : "article";
  const rootAttributes = item.ctaUrl
    ? `href="${escapeAttribute(item.ctaUrl)}" target="_blank" rel="noreferrer" class="result-card result-card-link result-card-${item.accent ?? section.kind}"`
    : `class="result-card result-card-${item.accent ?? section.kind}"`;

  return `
    <${rootTag} ${rootAttributes}>
      ${item.imageUrl ? `<div class="result-image" style="background-image:url('${escapeAttribute(item.imageUrl)}')"></div>` : ""}
      <div class="result-body">
        <div class="result-top">
          <div>
            <h4>${escapeHtml(item.title)}</h4>
            ${item.subtitle ? `<p class="subtitle">${escapeHtml(item.subtitle)}</p>` : ""}
          </div>
          ${item.price ? `<strong class="price">${escapeHtml(item.price)}</strong>` : ""}
        </div>
        ${
          item.meta?.length
            ? `<div class="meta-row">${item.meta.map((meta) => `<span>${escapeHtml(meta)}</span>`).join("")}</div>`
            : ""
        }

        ${item.description ? `<div class="description markdown-body">${renderRichText(item.description)}</div>` : ""}
        <div class="card-actions">
          ${
            item.ctaUrl
              ? `<span class="card-link-hint">${icon("open")} ${escapeHtml(item.ctaLabel ?? "Open option")}</span>`
              : `<button class="ghost ghost-compact result-action" data-followup="${escapeAttribute(followUp)}">${icon("use")}Use this option</button>`
          }
          <button class="ghost ghost-compact result-action" data-followup="${escapeAttribute(followUp)}">${icon("spark")}Ask about this</button>
        </div>
      </div>
    </${rootTag}>
  `;
}

function buildFollowUp(item: ResultItem, section: ResultSection) {
  const subject = item.title || section.title;
  if (section.kind === "hotel") return `Show me more details for ${subject} and help me book it.`;
  if (section.kind === "flight") return `Compare this flight option: ${subject}, then help me book the best one.`;
  if (section.kind === "car") {
    return item.fareCode
      ? `Revalidate and book this car: ${subject} (fareCode: ${item.fareCode}).`
      : `Show me more details for this car option: ${subject} and help me book it.`;
  }
  if (section.kind === "booking") return `Continue with ${subject}.`;
  return `Tell me more about ${subject}.`;
}

function wireEvents() {
  document.querySelector("#settings-toggle")?.addEventListener("click", () => {
    state.settingsOpen = !state.settingsOpen;
    render();
  });

  document.querySelector("#diagnostics-toggle")?.addEventListener("click", () => {
    state.diagnosticsOpen = !state.diagnosticsOpen;
    render();
  });

  document.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.searchMode = button.dataset.mode as typeof state.searchMode;
      render();
    });
  });

  document.querySelector("#prompt")?.addEventListener("input", (event) => {
    state.promptDraft = (event.target as HTMLTextAreaElement).value;
  });

  document.querySelector("#search-btn")?.addEventListener("click", async () => {
    const prompt = state.promptDraft.trim() || buildPageDrivenPrompt(state.searchMode, state.pageContext);
    if (!prompt) {
      state.assistantMessage = "Add a request or open a travel-related page so I can search live inventory.";
      render();
      return;
    }

    state.loading = true;
    state.assistantMessage = `Searching ${state.searchMode}...`;
    render();

    const response = await sendRequest({
      type: "ROUTESTACK_CHAT",
      tabId: state.tabId,
      prompt,
      searchMode: state.searchMode,
    });

    state.loading = false;

    if (response.ok) {
      applyPayload(response);
    } else {
      state.assistantMessage = response.error;
      state.settings = response.settings ?? state.settings;
    }

    render();
  });

  document.querySelectorAll<HTMLButtonElement>(".result-action").forEach((button) => {
    button.addEventListener("click", () => {
      state.promptDraft = button.dataset.followup ?? "";
      render();
      document.querySelector<HTMLTextAreaElement>("#prompt")?.focus();
    });
  });

  document.querySelector("#reset-btn")?.addEventListener("click", async () => {
    const response = await sendRequest({
      type: "ROUTESTACK_RESET",
      tabId: state.tabId,
    });

    if (response.ok) {
      applyPayload(response);
    } else {
      state.assistantMessage = response.error;
    }

    state.promptDraft = "";
    render();
  });

  document.querySelector("#save-settings-btn")?.addEventListener("click", async () => {
    const settings = collectSettingsForm();
    state.settings = await saveSettings(settings);
    state.settingsIssues = [];
    state.assistantMessage = "Settings saved. You can run a live search now.";
    render();
  });
}

function collectSettingsForm(): Partial<ExtensionSettings> {
  return {
    routestack: {
      apiKey: valueOf("#routestack-api-key"),
      apiSecret: valueOf("#routestack-api-secret"),
      mcpUrl: valueOf("#routestack-mcp-url"),
    },
    llm: {
      provider: valueOf("#llm-provider") as ExtensionSettings["llm"]["provider"],
      openai: {
        apiKey: valueOf("#openai-api-key"),
        model: valueOf("#openai-model"),
      },
      anthropic: {
        apiKey: valueOf("#anthropic-api-key"),
        model: valueOf("#anthropic-model"),
      },
      mistral: {
        apiKey: valueOf("#mistral-api-key"),
        model: valueOf("#mistral-model"),
        baseUrl: valueOf("#mistral-base-url"),
      },
    },
  };
}

async function sendRequest(request: PanelRequest): Promise<PanelResponse> {
  return chrome.runtime.sendMessage(request) as Promise<PanelResponse>;
}

function applyPayload(response: Extract<PanelResponse, { ok: true }>) {
  state.pageContext = response.payload.pageContext;
  state.assistantMessage = response.payload.assistantMessage;
  state.resultSections = response.payload.resultSections;
  state.toolCalls = response.payload.toolCalls.map((toolCall) => ({
    name: toolCall.name,
    summary: toolCall.summary,
  }));
  state.settingsIssues = response.payload.settingsIssues;
  state.settings = response.settings;

  if (!response.payload.pageContext) {
    state.pageSummary = "";
    return;
  }

  const hints = response.payload.pageContext.travelHints.join(" | ") || "No travel hints found on the page.";
  state.pageSummary = `${response.payload.pageContext.title} | ${hints}`;

  if (!state.promptDraft.trim()) {
    const inferredMode = inferSearchModeFromPageContext(response.payload.pageContext);
    state.searchMode = inferredMode;
    state.promptDraft = buildPageDrivenPrompt(inferredMode, response.payload.pageContext);
  }
}

function valueOf(selector: string): string {
  const element = document.querySelector<HTMLInputElement | HTMLSelectElement>(selector);
  return element?.value.trim() ?? "";
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderHtmlDescription(value: string) {
  const template = document.createElement("template");
  template.innerHTML = value;

  const allowedTags = new Set([
    "P",
    "BR",
    "STRONG",
    "B",
    "EM",
    "I",
    "UL",
    "OL",
    "LI",
  ]);

  const sanitizeNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return escapeHtml(node.textContent ?? "");
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    const element = node as HTMLElement;
    const tag = element.tagName.toUpperCase();

    const children = Array.from(element.childNodes)
      .map((child) => sanitizeNode(child))
      .join("");

    if (!allowedTags.has(tag)) {
      return children;
    }

    const tagName = tag.toLowerCase();
    return `<${tagName}>${children}</${tagName}>`;
  };

  return Array.from(template.content.childNodes)
    .map((node) => sanitizeNode(node))
    .join("");
}

function escapeAttribute(value: string) {
  return escapeHtml(value);
}

function renderRichText(value: string) {
  const blocks = value.replace(/\r\n/g, "\n").split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  return blocks.map(renderBlock).join("");
}

function renderBlock(block: string) {
  const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return "";

  if (lines.every((line) => /^[-*•]\s+/.test(line))) {
    return `<ul>${lines.map((line) => `<li>${renderInline(line.replace(/^[-*•]\s+/, ""))}</li>`).join("")}</ul>`;
  }

  if (lines.every((line) => /^\d+\.\s+/.test(line))) {
    return `<ol>${lines.map((line) => `<li>${renderInline(line.replace(/^\d+\.\s+/, ""))}</li>`).join("")}</ol>`;
  }

  return `<p>${lines.map(renderInline).join("<br />")}</p>`;
}

function renderInline(value: string) {
  const imagePattern = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g;
  const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  const urlPattern = /(^|[\s(])(https?:\/\/[^\s<]+)/g;

  let html = escapeHtml(value);
  html = html.replace(imagePattern, (_match, alt, url) => {
    const safeAlt = escapeAttribute(alt);
    const safeUrl = escapeAttribute(url);
    return `<figure class="markdown-image"><img src="${safeUrl}" alt="${safeAlt}" loading="lazy" /><figcaption>${safeAlt}</figcaption></figure>`;
  });
  html = html.replace(linkPattern, (_match, label, url) => {
    const safeLabel = escapeHtml(label);
    const safeUrl = escapeAttribute(url);
    return `<a href="${safeUrl}" target="_blank" rel="noreferrer">${safeLabel}</a>`;
  });
  html = html.replace(urlPattern, (_match, prefix, url) => {
    const safeUrl = escapeAttribute(url);
    return `${prefix}<a href="${safeUrl}" target="_blank" rel="noreferrer">${safeUrl}</a>`;
  });
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/(^|[\s>])\*([^*]+)\*(?=$|[\s<])/g, "$1<em>$2</em>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  return html;
}

function inferSearchModeFromPageContext(
  pageContext: Extract<PanelResponse, { ok: true }>["payload"]["pageContext"],
): "hotels" | "flights" | "cars" {
  if (!pageContext) return "hotels";

  const source = [
    pageContext.title,
    pageContext.description,
    pageContext.selection,
    pageContext.headings.join(" "),
    pageContext.travelHints.join(" "),
    pageContext.textExcerpt,
  ]
    .join(" ")
    .toLowerCase();

  if (/\b(flight|flights|airline|airport|departure|arrival|nonstop|layover)\b/.test(source)) {
    return "flights";
  }
  if (/\b(car|cars|rental|rent a car|vehicle|pickup|dropoff|drop-off)\b/.test(source)) {
    return "cars";
  }
  return "hotels";
}

function buildPageDrivenPrompt(
  mode: "hotels" | "flights" | "cars",
  pageContext: Extract<PanelResponse, { ok: true }>["payload"]["pageContext"],
): string {
  if (!pageContext) return "";

  const hints = pageContext.travelHints.join("; ");
  const contextSnippets = [pageContext.selection, pageContext.description, pageContext.textExcerpt]
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (mode === "flights") {
    return `Use this page context to search flights. Focus on dates, route, and travelers from: ${hints || pageContext.title}. ${contextSnippets.join(" ")}`.trim();
  }
  if (mode === "cars") {
    return `Use this page context to search rental cars. Focus on pickup/drop-off location and dates from: ${hints || pageContext.title}. ${contextSnippets.join(" ")}`.trim();
  }
  return `Use this page context to search hotels. Focus on destination, stay dates, and guests from: ${hints || pageContext.title}. ${contextSnippets.join(" ")}`.trim();
}

function icon(name: string) {
  const icons: Record<string, string> = {
    hotels: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 15V5h3a2 2 0 0 1 2 2v1h5a4 4 0 0 1 4 4v3h-2v-2H5v2H3Zm5-5V7a1 1 0 0 0-1-1H5v4h3Zm2 0h5a2 2 0 1 0 0-4h-5v4Z"/></svg>`,
    flights: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m18 10-7 2-3 5-1-.3 1.2-5.1L4 10.5V9.4l4.2-1.1L7 3.2 8 3l3 5 7 2Z"/></svg>`,
    cars: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 14a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm10 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM4.1 11 5.7 6.8A2 2 0 0 1 7.6 5.5h4.8a2 2 0 0 1 1.9 1.3L15.9 11H17a1 1 0 0 1 1 1v2h-1a2 2 0 0 0-4 0H7a2 2 0 0 0-4 0H2v-2a1 1 0 0 1 1-1h1.1ZM6.3 11h7.4l-1.2-3.2a1 1 0 0 0-.9-.6H8.4a1 1 0 0 0-.9.6L6.3 11Z"/></svg>`,
    booking: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 4h12v12H4V4Zm2 2v8h8V6H6Zm1 2h6v1H7V8Zm0 2h4v1H7v-1Z"/></svg>`,
    hotel: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 15V5h3a2 2 0 0 1 2 2v1h5a4 4 0 0 1 4 4v3h-2v-2H5v2H3Z"/></svg>`,
    flight: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m18 10-7 2-3 5-1-.3 1.2-5.1L4 10.5V9.4l4.2-1.1L7 3.2 8 3l3 5 7 2Z"/></svg>`,
    car: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.1 11 5.7 6.8A2 2 0 0 1 7.6 5.5h4.8a2 2 0 0 1 1.9 1.3L15.9 11H17a1 1 0 0 1 1 1v2h-1a2 2 0 0 0-4 0H7a2 2 0 0 0-4 0H2v-2a1 1 0 0 1 1-1h1.1Z"/></svg>`,
    context: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2a6 6 0 0 1 6 6c0 4.4-6 10-6 10S4 12.4 4 8a6 6 0 0 1 6-6Zm0 3.2A2.8 2.8 0 1 0 10 10.8a2.8 2.8 0 0 0 0-5.6Z"/></svg>`,
    spark: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m10 2 1.7 4.8L16.5 8l-4.8 1.2L10 14l-1.7-4.8L3.5 8l4.8-1.2L10 2Zm5.5 10 1 2.7 2.5.8-2.5.7-1 2.8-1-2.8-2.5-.7 2.5-.8 1-2.7Z"/></svg>`,
    trace: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 4h14v2H3V4Zm0 5h9v2H3V9Zm0 5h14v2H3v-2Zm11-5h3v2h-3V9Z"/></svg>`,
    send: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 17 18 10 3 3l1.6 5.4L12 10 4.6 11.6 3 17Z"/></svg>`,
    save: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 3h9l3 3v11H4V3Zm2 2v3h7V5H6Zm0 7v3h8v-3H6Z"/></svg>`,
    open: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M11 4h5v5h-2V7.4l-5.3 5.3-1.4-1.4L12.6 6H11V4ZM5 6h4v2H7v6h6v-2h2v4H5V6Z"/></svg>`,
    use: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m8.4 13.6-3-3 1.4-1.4 1.6 1.6 4.8-4.8 1.4 1.4-6.2 6.2Z"/></svg>`,
    empty: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 5h12v10H4V5Zm2 2v6h8V7H6Zm1 1h6v1H7V8Zm0 2h4v1H7v-1Z"/></svg>`,
  };

  return `<span class="icon icon-${escapeAttribute(name)}">${icons[name] ?? icons.spark}</span>`;
}
