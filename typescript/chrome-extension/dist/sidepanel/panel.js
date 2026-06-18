// src/lib/build-config.generated.ts
var buildDefaults = {
  routestack: { apiKey: "rst_kAXfaCdG_aY5hmbM52GOtqDISyE3oQpu", apiSecret: "e6c98d07b21725bf732e69b98692ed5bcc98d52937aa789ccbce347d10198f59", mcpUrl: "https://mcp.routestack.ai/sse" },
  llm: {
    provider: "mistral",
    openai: { apiKey: "your_openai_key_here", model: "gpt-4o" },
    anthropic: { apiKey: "", model: "claude-sonnet-4-5-latest" },
    mistral: { apiKey: "SCYkAOLzpqF6H9SVvJeHR45uAQkSJWpT", model: "mistral-large-latest", baseUrl: "https://api.mistral.ai/v1" }
  }
};

// src/lib/config.ts
var defaults = {
  routestack: {
    apiKey: buildDefaults.routestack.apiKey,
    apiSecret: buildDefaults.routestack.apiSecret,
    mcpUrl: buildDefaults.routestack.mcpUrl
  },
  llm: {
    provider: normalizeProvider(buildDefaults.llm.provider),
    openai: {
      apiKey: buildDefaults.llm.openai.apiKey,
      model: buildDefaults.llm.openai.model
    },
    anthropic: {
      apiKey: buildDefaults.llm.anthropic.apiKey,
      model: buildDefaults.llm.anthropic.model
    },
    mistral: {
      apiKey: buildDefaults.llm.mistral.apiKey,
      model: buildDefaults.llm.mistral.model,
      baseUrl: buildDefaults.llm.mistral.baseUrl
    }
  }
};
async function getSettings() {
  const stored = await chrome.storage.local.get("routestack_settings");
  return mergeSettings(defaults, stored.routestack_settings);
}
async function saveSettings(settings) {
  const merged = mergeSettings(await getSettings(), settings);
  await chrome.storage.local.set({ routestack_settings: merged });
  return merged;
}
function mergeSettings(base, incoming) {
  return {
    routestack: {
      apiKey: incoming?.routestack?.apiKey ?? base.routestack.apiKey,
      apiSecret: incoming?.routestack?.apiSecret ?? base.routestack.apiSecret,
      mcpUrl: incoming?.routestack?.mcpUrl ?? base.routestack.mcpUrl
    },
    llm: {
      provider: normalizeProvider(incoming?.llm?.provider ?? base.llm.provider),
      openai: {
        apiKey: incoming?.llm?.openai?.apiKey ?? base.llm.openai.apiKey,
        model: incoming?.llm?.openai?.model ?? base.llm.openai.model
      },
      anthropic: {
        apiKey: incoming?.llm?.anthropic?.apiKey ?? base.llm.anthropic.apiKey,
        model: incoming?.llm?.anthropic?.model ?? base.llm.anthropic.model
      },
      mistral: {
        apiKey: incoming?.llm?.mistral?.apiKey ?? base.llm.mistral.apiKey,
        model: incoming?.llm?.mistral?.model ?? base.llm.mistral.model,
        baseUrl: incoming?.llm?.mistral?.baseUrl ?? base.llm.mistral.baseUrl
      }
    }
  };
}
function normalizeProvider(value) {
  if (value === "anthropic" || value === "mistral") return value;
  return "openai";
}

// src/sidepanel/panel.ts
var appRoot = document.querySelector("#app");
if (!appRoot) {
  throw new Error("RouteStack side panel root was not found.");
}
var app = appRoot;
var state = {
  tabId: 0,
  loading: false,
  searchMode: "hotels",
  settingsOpen: false,
  diagnosticsOpen: false,
  assistantMessage: "",
  pageSummary: "",
  promptDraft: "",
  resultSections: [],
  toolCalls: [],
  settingsIssues: [],
  settings: null,
  pageContext: null
};
void bootstrap();
async function bootstrap() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  state.tabId = tab?.id ?? 0;
  const response = await sendRequest({
    type: "ROUTESTACK_BOOTSTRAP",
    tabId: state.tabId
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
            ${["hotels", "flights", "cars"].map(
    (mode) => `
                  <button class="pill ${state.searchMode === mode ? "pill-active" : ""}" data-mode="${mode}">
                    ${icon(mode)}${capitalize(mode)}
                  </button>
                `
  ).join("")}
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
            ${["openai", "anthropic", "mistral"].map(
    (provider) => `<option value="${provider}" ${state.settings?.llm.provider === provider ? "selected" : ""}>${provider}</option>`
  ).join("")}
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
        ${state.toolCalls.map(
    (toolCall) => `
              <div class="trace-row">
                <strong>${escapeHtml(toolCall.name)}</strong>
                <span>${escapeHtml(toolCall.summary)}</span>
              </div>
            `
  ).join("")}
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
      ${state.resultSections.map(
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
          `
  ).join("")}
    </section>
  `;
}
function renderResultCard(item, section) {
  const followUp = buildFollowUp(item, section);
  const rootTag = item.ctaUrl ? "a" : "article";
  const rootAttributes = item.ctaUrl ? `href="${escapeAttribute(item.ctaUrl)}" target="_blank" rel="noreferrer" class="result-card result-card-link result-card-${item.accent ?? section.kind}"` : `class="result-card result-card-${item.accent ?? section.kind}"`;
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
        ${item.meta?.length ? `<div class="meta-row">${item.meta.map((meta) => `<span>${escapeHtml(meta)}</span>`).join("")}</div>` : ""}

        ${item.description ? `<div class="description markdown-body">${renderRichText(item.description)}</div>` : ""}
        <div class="card-actions">
          ${item.ctaUrl ? `<span class="card-link-hint">${icon("open")} ${escapeHtml(item.ctaLabel ?? "Open option")}</span>` : `<button class="ghost ghost-compact result-action" data-followup="${escapeAttribute(followUp)}">${icon("use")}Use this option</button>`}
          <button class="ghost ghost-compact result-action" data-followup="${escapeAttribute(followUp)}">${icon("spark")}Ask about this</button>
        </div>
      </div>
    </${rootTag}>
  `;
}
function buildFollowUp(item, section) {
  const subject = item.title || section.title;
  if (section.kind === "hotel") return `Show me more details for ${subject} and help me book it.`;
  if (section.kind === "flight") return `Compare this flight option: ${subject}, then help me book the best one.`;
  if (section.kind === "car") {
    return item.fareCode ? `Revalidate and book this car: ${subject} (fareCode: ${item.fareCode}).` : `Show me more details for this car option: ${subject} and help me book it.`;
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
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.searchMode = button.dataset.mode;
      render();
    });
  });
  document.querySelector("#prompt")?.addEventListener("input", (event) => {
    state.promptDraft = event.target.value;
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
      searchMode: state.searchMode
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
  document.querySelectorAll(".result-action").forEach((button) => {
    button.addEventListener("click", () => {
      state.promptDraft = button.dataset.followup ?? "";
      render();
      document.querySelector("#prompt")?.focus();
    });
  });
  document.querySelector("#reset-btn")?.addEventListener("click", async () => {
    const response = await sendRequest({
      type: "ROUTESTACK_RESET",
      tabId: state.tabId
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
function collectSettingsForm() {
  return {
    routestack: {
      apiKey: valueOf("#routestack-api-key"),
      apiSecret: valueOf("#routestack-api-secret"),
      mcpUrl: valueOf("#routestack-mcp-url")
    },
    llm: {
      provider: valueOf("#llm-provider"),
      openai: {
        apiKey: valueOf("#openai-api-key"),
        model: valueOf("#openai-model")
      },
      anthropic: {
        apiKey: valueOf("#anthropic-api-key"),
        model: valueOf("#anthropic-model")
      },
      mistral: {
        apiKey: valueOf("#mistral-api-key"),
        model: valueOf("#mistral-model"),
        baseUrl: valueOf("#mistral-base-url")
      }
    }
  };
}
async function sendRequest(request) {
  return chrome.runtime.sendMessage(request);
}
function applyPayload(response) {
  state.pageContext = response.payload.pageContext;
  state.assistantMessage = response.payload.assistantMessage;
  state.resultSections = response.payload.resultSections;
  state.toolCalls = response.payload.toolCalls.map((toolCall) => ({
    name: toolCall.name,
    summary: toolCall.summary
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
function valueOf(selector) {
  const element = document.querySelector(selector);
  return element?.value.trim() ?? "";
}
function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function escapeAttribute(value) {
  return escapeHtml(value);
}
function renderRichText(value) {
  const blocks = value.replace(/\r\n/g, "\n").split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  return blocks.map(renderBlock).join("");
}
function renderBlock(block) {
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
function renderInline(value) {
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
function inferSearchModeFromPageContext(pageContext) {
  if (!pageContext) return "hotels";
  const source = [
    pageContext.title,
    pageContext.description,
    pageContext.selection,
    pageContext.headings.join(" "),
    pageContext.travelHints.join(" "),
    pageContext.textExcerpt
  ].join(" ").toLowerCase();
  if (/\b(flight|flights|airline|airport|departure|arrival|nonstop|layover)\b/.test(source)) {
    return "flights";
  }
  if (/\b(car|cars|rental|rent a car|vehicle|pickup|dropoff|drop-off)\b/.test(source)) {
    return "cars";
  }
  return "hotels";
}
function buildPageDrivenPrompt(mode, pageContext) {
  if (!pageContext) return "";
  const hints = pageContext.travelHints.join("; ");
  const contextSnippets = [pageContext.selection, pageContext.description, pageContext.textExcerpt].map((value) => value.trim()).filter(Boolean).slice(0, 2);
  if (mode === "flights") {
    return `Use this page context to search flights. Focus on dates, route, and travelers from: ${hints || pageContext.title}. ${contextSnippets.join(" ")}`.trim();
  }
  if (mode === "cars") {
    return `Use this page context to search rental cars. Focus on pickup/drop-off location and dates from: ${hints || pageContext.title}. ${contextSnippets.join(" ")}`.trim();
  }
  return `Use this page context to search hotels. Focus on destination, stay dates, and guests from: ${hints || pageContext.title}. ${contextSnippets.join(" ")}`.trim();
}
function icon(name) {
  const icons = {
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
    empty: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 5h12v10H4V5Zm2 2v6h8V7H6Zm1 1h6v1H7V8Zm0 2h4v1H7v-1Z"/></svg>`
  };
  return `<span class="icon icon-${escapeAttribute(name)}">${icons[name] ?? icons.spark}</span>`;
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc3JjL2xpYi9idWlsZC1jb25maWcuZ2VuZXJhdGVkLnRzIiwgIi4uLy4uL3NyYy9saWIvY29uZmlnLnRzIiwgIi4uLy4uL3NyYy9zaWRlcGFuZWwvcGFuZWwudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImV4cG9ydCBjb25zdCBidWlsZERlZmF1bHRzID0ge1xuICByb3V0ZXN0YWNrOiB7IGFwaUtleTogXCJyc3Rfa0FYZmFDZEdfYVk1aG1iTTUyR090cURJU3lFM29RcHVcIiwgYXBpU2VjcmV0OiBcImU2Yzk4ZDA3YjIxNzI1YmY3MzJlNjliOTg2OTJlZDViY2M5OGQ1MjkzN2FhNzg5Y2NiY2UzNDdkMTAxOThmNTlcIiwgbWNwVXJsOiBcImh0dHBzOi8vbWNwLnJvdXRlc3RhY2suYWkvc3NlXCIgfSxcbiAgbGxtOiB7XG4gICAgcHJvdmlkZXI6IFwibWlzdHJhbFwiLFxuICAgIG9wZW5haTogeyBhcGlLZXk6IFwieW91cl9vcGVuYWlfa2V5X2hlcmVcIiwgbW9kZWw6IFwiZ3B0LTRvXCIgfSxcbiAgICBhbnRocm9waWM6IHsgYXBpS2V5OiBcIlwiLCBtb2RlbDogXCJjbGF1ZGUtc29ubmV0LTQtNS1sYXRlc3RcIiB9LFxuICAgIG1pc3RyYWw6IHsgYXBpS2V5OiBcIlNDWWtBT0x6cHFGNkg5U1Z2SmVIUjQ1dUFRa1NKV3BUXCIsIG1vZGVsOiBcIm1pc3RyYWwtbGFyZ2UtbGF0ZXN0XCIsIGJhc2VVcmw6IFwiaHR0cHM6Ly9hcGkubWlzdHJhbC5haS92MVwiIH0sXG4gIH0sXG59IGFzIGNvbnN0O1xuIiwgImltcG9ydCB7IGJ1aWxkRGVmYXVsdHMgfSBmcm9tIFwiLi9idWlsZC1jb25maWcuZ2VuZXJhdGVkLmpzXCI7XHJcblxyXG5leHBvcnQgdHlwZSBMbG1Qcm92aWRlciA9IFwib3BlbmFpXCIgfCBcImFudGhyb3BpY1wiIHwgXCJtaXN0cmFsXCI7XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIEV4dGVuc2lvblNldHRpbmdzIHtcclxuICByb3V0ZXN0YWNrOiB7XHJcbiAgICBhcGlLZXk6IHN0cmluZztcclxuICAgIGFwaVNlY3JldDogc3RyaW5nO1xyXG4gICAgbWNwVXJsOiBzdHJpbmc7XHJcbiAgfTtcclxuICBsbG06IHtcclxuICAgIHByb3ZpZGVyOiBMbG1Qcm92aWRlcjtcclxuICAgIG9wZW5haToge1xyXG4gICAgICBhcGlLZXk6IHN0cmluZztcclxuICAgICAgbW9kZWw6IHN0cmluZztcclxuICAgIH07XHJcbiAgICBhbnRocm9waWM6IHtcclxuICAgICAgYXBpS2V5OiBzdHJpbmc7XHJcbiAgICAgIG1vZGVsOiBzdHJpbmc7XHJcbiAgICB9O1xyXG4gICAgbWlzdHJhbDoge1xyXG4gICAgICBhcGlLZXk6IHN0cmluZztcclxuICAgICAgbW9kZWw6IHN0cmluZztcclxuICAgICAgYmFzZVVybDogc3RyaW5nO1xyXG4gICAgfTtcclxuICB9O1xyXG59XHJcblxyXG5jb25zdCBkZWZhdWx0czogRXh0ZW5zaW9uU2V0dGluZ3MgPSB7XHJcbiAgcm91dGVzdGFjazoge1xyXG4gICAgYXBpS2V5OiBidWlsZERlZmF1bHRzLnJvdXRlc3RhY2suYXBpS2V5LFxyXG4gICAgYXBpU2VjcmV0OiBidWlsZERlZmF1bHRzLnJvdXRlc3RhY2suYXBpU2VjcmV0LFxyXG4gICAgbWNwVXJsOiBidWlsZERlZmF1bHRzLnJvdXRlc3RhY2subWNwVXJsLFxyXG4gIH0sXHJcbiAgbGxtOiB7XHJcbiAgICBwcm92aWRlcjogbm9ybWFsaXplUHJvdmlkZXIoYnVpbGREZWZhdWx0cy5sbG0ucHJvdmlkZXIpLFxyXG4gICAgb3BlbmFpOiB7XHJcbiAgICAgIGFwaUtleTogYnVpbGREZWZhdWx0cy5sbG0ub3BlbmFpLmFwaUtleSxcclxuICAgICAgbW9kZWw6IGJ1aWxkRGVmYXVsdHMubGxtLm9wZW5haS5tb2RlbCxcclxuICAgIH0sXHJcbiAgICBhbnRocm9waWM6IHtcclxuICAgICAgYXBpS2V5OiBidWlsZERlZmF1bHRzLmxsbS5hbnRocm9waWMuYXBpS2V5LFxyXG4gICAgICBtb2RlbDogYnVpbGREZWZhdWx0cy5sbG0uYW50aHJvcGljLm1vZGVsLFxyXG4gICAgfSxcclxuICAgIG1pc3RyYWw6IHtcclxuICAgICAgYXBpS2V5OiBidWlsZERlZmF1bHRzLmxsbS5taXN0cmFsLmFwaUtleSxcclxuICAgICAgbW9kZWw6IGJ1aWxkRGVmYXVsdHMubGxtLm1pc3RyYWwubW9kZWwsXHJcbiAgICAgIGJhc2VVcmw6IGJ1aWxkRGVmYXVsdHMubGxtLm1pc3RyYWwuYmFzZVVybCxcclxuICAgIH0sXHJcbiAgfSxcclxufTtcclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRTZXR0aW5ncygpOiBQcm9taXNlPEV4dGVuc2lvblNldHRpbmdzPiB7XHJcbiAgY29uc3Qgc3RvcmVkID0gYXdhaXQgY2hyb21lLnN0b3JhZ2UubG9jYWwuZ2V0KFwicm91dGVzdGFja19zZXR0aW5nc1wiKTtcclxuICByZXR1cm4gbWVyZ2VTZXR0aW5ncyhkZWZhdWx0cywgc3RvcmVkLnJvdXRlc3RhY2tfc2V0dGluZ3MgYXMgUGFydGlhbDxFeHRlbnNpb25TZXR0aW5ncz4gfCB1bmRlZmluZWQpO1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc2F2ZVNldHRpbmdzKHNldHRpbmdzOiBQYXJ0aWFsPEV4dGVuc2lvblNldHRpbmdzPik6IFByb21pc2U8RXh0ZW5zaW9uU2V0dGluZ3M+IHtcclxuICBjb25zdCBtZXJnZWQgPSBtZXJnZVNldHRpbmdzKGF3YWl0IGdldFNldHRpbmdzKCksIHNldHRpbmdzKTtcclxuICBhd2FpdCBjaHJvbWUuc3RvcmFnZS5sb2NhbC5zZXQoeyByb3V0ZXN0YWNrX3NldHRpbmdzOiBtZXJnZWQgfSk7XHJcbiAgcmV0dXJuIG1lcmdlZDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGdldFByb3ZpZGVyQXBpS2V5KHNldHRpbmdzOiBFeHRlbnNpb25TZXR0aW5ncyk6IHN0cmluZyB7XHJcbiAgaWYgKHNldHRpbmdzLmxsbS5wcm92aWRlciA9PT0gXCJhbnRocm9waWNcIikgcmV0dXJuIHNldHRpbmdzLmxsbS5hbnRocm9waWMuYXBpS2V5O1xyXG4gIGlmIChzZXR0aW5ncy5sbG0ucHJvdmlkZXIgPT09IFwibWlzdHJhbFwiKSByZXR1cm4gc2V0dGluZ3MubGxtLm1pc3RyYWwuYXBpS2V5O1xyXG4gIHJldHVybiBzZXR0aW5ncy5sbG0ub3BlbmFpLmFwaUtleTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHZhbGlkYXRlU2V0dGluZ3Moc2V0dGluZ3M6IEV4dGVuc2lvblNldHRpbmdzKTogc3RyaW5nW10ge1xyXG4gIGNvbnN0IGlzc3Vlczogc3RyaW5nW10gPSBbXTtcclxuXHJcbiAgaWYgKCFzZXR0aW5ncy5yb3V0ZXN0YWNrLmFwaUtleSkgaXNzdWVzLnB1c2goXCJSb3V0ZVN0YWNrIEFQSSBrZXkgaXMgbWlzc2luZy5cIik7XHJcbiAgaWYgKCFzZXR0aW5ncy5yb3V0ZXN0YWNrLm1jcFVybCkgaXNzdWVzLnB1c2goXCJSb3V0ZVN0YWNrIE1DUCBVUkwgaXMgbWlzc2luZy5cIik7XHJcbiAgaWYgKCFnZXRQcm92aWRlckFwaUtleShzZXR0aW5ncykpIHtcclxuICAgIGlzc3Vlcy5wdXNoKGBUaGUgJHtzZXR0aW5ncy5sbG0ucHJvdmlkZXJ9IEFQSSBrZXkgaXMgbWlzc2luZy5gKTtcclxuICB9XHJcblxyXG4gIHJldHVybiBpc3N1ZXM7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIG1lcmdlU2V0dGluZ3MoXHJcbiAgYmFzZTogRXh0ZW5zaW9uU2V0dGluZ3MsXHJcbiAgaW5jb21pbmc/OiBQYXJ0aWFsPEV4dGVuc2lvblNldHRpbmdzPixcclxuKTogRXh0ZW5zaW9uU2V0dGluZ3Mge1xyXG4gIHJldHVybiB7XHJcbiAgICByb3V0ZXN0YWNrOiB7XHJcbiAgICAgIGFwaUtleTogaW5jb21pbmc/LnJvdXRlc3RhY2s/LmFwaUtleSA/PyBiYXNlLnJvdXRlc3RhY2suYXBpS2V5LFxyXG4gICAgICBhcGlTZWNyZXQ6IGluY29taW5nPy5yb3V0ZXN0YWNrPy5hcGlTZWNyZXQgPz8gYmFzZS5yb3V0ZXN0YWNrLmFwaVNlY3JldCxcclxuICAgICAgbWNwVXJsOiBpbmNvbWluZz8ucm91dGVzdGFjaz8ubWNwVXJsID8/IGJhc2Uucm91dGVzdGFjay5tY3BVcmwsXHJcbiAgICB9LFxyXG4gICAgbGxtOiB7XHJcbiAgICAgIHByb3ZpZGVyOiBub3JtYWxpemVQcm92aWRlcihpbmNvbWluZz8ubGxtPy5wcm92aWRlciA/PyBiYXNlLmxsbS5wcm92aWRlciksXHJcbiAgICAgIG9wZW5haToge1xyXG4gICAgICAgIGFwaUtleTogaW5jb21pbmc/LmxsbT8ub3BlbmFpPy5hcGlLZXkgPz8gYmFzZS5sbG0ub3BlbmFpLmFwaUtleSxcclxuICAgICAgICBtb2RlbDogaW5jb21pbmc/LmxsbT8ub3BlbmFpPy5tb2RlbCA/PyBiYXNlLmxsbS5vcGVuYWkubW9kZWwsXHJcbiAgICAgIH0sXHJcbiAgICAgIGFudGhyb3BpYzoge1xyXG4gICAgICAgIGFwaUtleTogaW5jb21pbmc/LmxsbT8uYW50aHJvcGljPy5hcGlLZXkgPz8gYmFzZS5sbG0uYW50aHJvcGljLmFwaUtleSxcclxuICAgICAgICBtb2RlbDogaW5jb21pbmc/LmxsbT8uYW50aHJvcGljPy5tb2RlbCA/PyBiYXNlLmxsbS5hbnRocm9waWMubW9kZWwsXHJcbiAgICAgIH0sXHJcbiAgICAgIG1pc3RyYWw6IHtcclxuICAgICAgICBhcGlLZXk6IGluY29taW5nPy5sbG0/Lm1pc3RyYWw/LmFwaUtleSA/PyBiYXNlLmxsbS5taXN0cmFsLmFwaUtleSxcclxuICAgICAgICBtb2RlbDogaW5jb21pbmc/LmxsbT8ubWlzdHJhbD8ubW9kZWwgPz8gYmFzZS5sbG0ubWlzdHJhbC5tb2RlbCxcclxuICAgICAgICBiYXNlVXJsOiBpbmNvbWluZz8ubGxtPy5taXN0cmFsPy5iYXNlVXJsID8/IGJhc2UubGxtLm1pc3RyYWwuYmFzZVVybCxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgfTtcclxufVxyXG5cclxuZnVuY3Rpb24gbm9ybWFsaXplUHJvdmlkZXIodmFsdWU6IHN0cmluZyk6IExsbVByb3ZpZGVyIHtcclxuICBpZiAodmFsdWUgPT09IFwiYW50aHJvcGljXCIgfHwgdmFsdWUgPT09IFwibWlzdHJhbFwiKSByZXR1cm4gdmFsdWU7XHJcbiAgcmV0dXJuIFwib3BlbmFpXCI7XHJcbn1cclxuXHJcbiIsICJpbXBvcnQgeyBzYXZlU2V0dGluZ3MsIHR5cGUgRXh0ZW5zaW9uU2V0dGluZ3MgfSBmcm9tIFwiLi4vbGliL2NvbmZpZy5qc1wiO1xyXG5pbXBvcnQgdHlwZSB7IFBhbmVsUmVxdWVzdCwgUGFuZWxSZXNwb25zZSwgUmVzdWx0SXRlbSwgUmVzdWx0U2VjdGlvbiB9IGZyb20gXCIuLi9saWIvdHlwZXMuanNcIjtcclxuXHJcbmNvbnN0IGFwcFJvb3QgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yPEhUTUxEaXZFbGVtZW50PihcIiNhcHBcIik7XHJcblxyXG5pZiAoIWFwcFJvb3QpIHtcclxuICB0aHJvdyBuZXcgRXJyb3IoXCJSb3V0ZVN0YWNrIHNpZGUgcGFuZWwgcm9vdCB3YXMgbm90IGZvdW5kLlwiKTtcclxufVxyXG5cclxuY29uc3QgYXBwID0gYXBwUm9vdDtcclxuXHJcbmNvbnN0IHN0YXRlID0ge1xyXG4gIHRhYklkOiAwLFxyXG4gIGxvYWRpbmc6IGZhbHNlLFxyXG4gIHNlYXJjaE1vZGU6IFwiaG90ZWxzXCIgYXMgXCJob3RlbHNcIiB8IFwiZmxpZ2h0c1wiIHwgXCJjYXJzXCIsXHJcbiAgc2V0dGluZ3NPcGVuOiBmYWxzZSxcclxuICBkaWFnbm9zdGljc09wZW46IGZhbHNlLFxyXG4gIGFzc2lzdGFudE1lc3NhZ2U6IFwiXCIsXHJcbiAgcGFnZVN1bW1hcnk6IFwiXCIsXHJcbiAgcHJvbXB0RHJhZnQ6IFwiXCIsXHJcbiAgcmVzdWx0U2VjdGlvbnM6IFtdIGFzIFJlc3VsdFNlY3Rpb25bXSxcclxuICB0b29sQ2FsbHM6IFtdIGFzIEFycmF5PHsgbmFtZTogc3RyaW5nOyBzdW1tYXJ5OiBzdHJpbmcgfT4sXHJcbiAgc2V0dGluZ3NJc3N1ZXM6IFtdIGFzIHN0cmluZ1tdLFxyXG4gIHNldHRpbmdzOiBudWxsIGFzIEV4dGVuc2lvblNldHRpbmdzIHwgbnVsbCxcclxuICBwYWdlQ29udGV4dDogbnVsbCBhcyBFeHRyYWN0PFBhbmVsUmVzcG9uc2UsIHsgb2s6IHRydWUgfT5bXCJwYXlsb2FkXCJdW1wicGFnZUNvbnRleHRcIl0sXHJcbn07XHJcblxyXG52b2lkIGJvb3RzdHJhcCgpO1xyXG5cclxuYXN5bmMgZnVuY3Rpb24gYm9vdHN0cmFwKCkge1xyXG4gIGNvbnN0IFt0YWJdID0gYXdhaXQgY2hyb21lLnRhYnMucXVlcnkoeyBhY3RpdmU6IHRydWUsIGN1cnJlbnRXaW5kb3c6IHRydWUgfSk7XHJcbiAgc3RhdGUudGFiSWQgPSB0YWI/LmlkID8/IDA7XHJcblxyXG4gIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgc2VuZFJlcXVlc3Qoe1xyXG4gICAgdHlwZTogXCJST1VURVNUQUNLX0JPT1RTVFJBUFwiLFxyXG4gICAgdGFiSWQ6IHN0YXRlLnRhYklkLFxyXG4gIH0pO1xyXG5cclxuICBpZiAocmVzcG9uc2Uub2spIHtcclxuICAgIGFwcGx5UGF5bG9hZChyZXNwb25zZSk7XHJcbiAgfSBlbHNlIHtcclxuICAgIHN0YXRlLmFzc2lzdGFudE1lc3NhZ2UgPSByZXNwb25zZS5lcnJvcjtcclxuICAgIHN0YXRlLnNldHRpbmdzID0gcmVzcG9uc2Uuc2V0dGluZ3MgPz8gbnVsbDtcclxuICB9XHJcblxyXG4gIHJlbmRlcigpO1xyXG59XHJcblxyXG5mdW5jdGlvbiByZW5kZXIoKSB7XHJcbiAgYXBwLmlubmVySFRNTCA9IGBcclxuICAgIDxkaXYgY2xhc3M9XCJzaGVsbFwiPlxyXG4gICAgICA8ZGl2IGNsYXNzPVwiY29udGVudC1hcmVhXCI+XHJcbiAgICAgICAgPHNlY3Rpb24gY2xhc3M9XCJoZXJvXCI+XHJcbiAgICAgICAgICA8ZGl2PlxyXG4gICAgICAgICAgICA8cCBjbGFzcz1cImV5ZWJyb3dcIj5Sb3V0ZVN0YWNrLmFpPC9wPlxyXG4gICAgICAgICAgICA8aDE+VHJhdmVsIHBsYW5uaW5nIHRoYXQgc3RheXMgaW4gdGhlIGZsb3cgb2YgdGhlIHBhZ2UuPC9oMT5cclxuICAgICAgICAgICAgPHAgY2xhc3M9XCJsZWRlXCI+U2VhcmNoIGhvdGVscywgZmxpZ2h0cywgYW5kIHJlbnRhbCBjYXJzIHdpdGhvdXQgbGVhdmluZyB3aGF0IHlvdSBhcmUgYWxyZWFkeSByZWFkaW5nLjwvcD5cclxuICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgPGRpdiBjbGFzcz1cImhlcm8tYWN0aW9uc1wiPlxyXG4gICAgICAgICAgICA8YnV0dG9uIGNsYXNzPVwiZ2hvc3RcIiBpZD1cInNldHRpbmdzLXRvZ2dsZVwiPiR7c3RhdGUuc2V0dGluZ3NPcGVuID8gXCJDbG9zZSBzZXR0aW5nc1wiIDogXCJTZXR0aW5nc1wifTwvYnV0dG9uPlxyXG4gICAgICAgICAgICA8YnV0dG9uIGNsYXNzPVwiZ2hvc3RcIiBpZD1cInJlc2V0LWJ0blwiICR7c3RhdGUubG9hZGluZyA/IFwiZGlzYWJsZWRcIiA6IFwiXCJ9PlJlc2V0PC9idXR0b24+XHJcbiAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICA8L3NlY3Rpb24+XHJcblxyXG4gICAgICAgICR7cmVuZGVyU2V0dGluZ3MoKX1cclxuXHJcbiAgICAgICAgPHNlY3Rpb24gY2xhc3M9XCJmZWVkLWNhcmRcIj5cclxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJmZWVkLWhlYWRcIj5cclxuICAgICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgICA8cCBjbGFzcz1cImV5ZWJyb3dcIj5Bc3Npc3RhbnQ8L3A+XHJcbiAgICAgICAgICAgICAgPGgyPllvdXIgdHJhdmVsIGRlc2s8L2gyPlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgJHtyZW5kZXJEaWFnbm9zdGljc1RvZ2dsZSgpfVxyXG4gICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgJHtzdGF0ZS5wYWdlU3VtbWFyeSA/IGA8ZGl2IGNsYXNzPVwiY29udGV4dC1jaGlwXCI+JHtpY29uKFwiY29udGV4dFwiKX0ke2VzY2FwZUh0bWwoc3RhdGUucGFnZVN1bW1hcnkpfTwvZGl2PmAgOiBcIlwifVxyXG5cclxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJhc3Npc3RhbnQtYnViYmxlICR7c3RhdGUubG9hZGluZyA/IFwiYXNzaXN0YW50LWJ1YmJsZS1saXZlXCIgOiBcIlwifVwiPlxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYnViYmxlLWljb25cIj4ke2ljb24oXCJzcGFya1wiKX08L2Rpdj5cclxuICAgICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgICA8cCBjbGFzcz1cImJ1YmJsZS10aXRsZVwiPiR7c3RhdGUubG9hZGluZyA/IFwiV29ya2luZyBvbiBpdFwiIDogXCJMYXRlc3QgdXBkYXRlXCJ9PC9wPlxyXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJidWJibGUtY29weSBtYXJrZG93bi1ib2R5XCI+JHtyZW5kZXJSaWNoVGV4dChzdGF0ZS5hc3Npc3RhbnRNZXNzYWdlIHx8IFwiU3RhcnQgd2l0aCBhIHRyYXZlbCByZXF1ZXN0IGFuZCBJJ2xsIHR1cm4gaXQgaW50byBib29rYWJsZSBvcHRpb25zLlwiKX08L2Rpdj5cclxuICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAke3JlbmRlckRpYWdub3N0aWNzKCl9XHJcbiAgICAgICAgICAke3JlbmRlclVuaWZpZWRSZXN1bHRzKCl9XHJcbiAgICAgICAgPC9zZWN0aW9uPlxyXG4gICAgICA8L2Rpdj5cclxuXHJcbiAgICAgIDxzZWN0aW9uIGNsYXNzPVwiY29tcG9zZXItZG9ja1wiPlxyXG4gICAgICAgIDxkaXYgY2xhc3M9XCJjb21wb3Nlci1jYXJkXCI+XHJcbiAgICAgICAgICA8ZGl2IGNsYXNzPVwibW9kZS1yb3dcIj5cclxuICAgICAgICAgICAgJHtbXCJob3RlbHNcIiwgXCJmbGlnaHRzXCIsIFwiY2Fyc1wiXVxyXG4gICAgICAgICAgICAgIC5tYXAoXHJcbiAgICAgICAgICAgICAgICAobW9kZSkgPT4gYFxyXG4gICAgICAgICAgICAgICAgICA8YnV0dG9uIGNsYXNzPVwicGlsbCAke3N0YXRlLnNlYXJjaE1vZGUgPT09IG1vZGUgPyBcInBpbGwtYWN0aXZlXCIgOiBcIlwifVwiIGRhdGEtbW9kZT1cIiR7bW9kZX1cIj5cclxuICAgICAgICAgICAgICAgICAgICAke2ljb24obW9kZSl9JHtjYXBpdGFsaXplKG1vZGUpfVxyXG4gICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgICAgIGAsXHJcbiAgICAgICAgICAgICAgKVxyXG4gICAgICAgICAgICAgIC5qb2luKFwiXCIpfVxyXG4gICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICA8dGV4dGFyZWEgaWQ9XCJwcm9tcHRcIiByb3dzPVwiM1wiIHBsYWNlaG9sZGVyPVwiRmluZCByZWZ1bmRhYmxlIGhvdGVscyBpbiBBdXN0aW4gZm9yIEp1bmUgMTQtMTYgZm9yIDIgYWR1bHRzLCBvciBhc2sgZm9yIHRoZSBiZXN0IG5vbnN0b3AgZmxpZ2h0IGZyb20gRGVudmVyLlwiPiR7ZXNjYXBlSHRtbChzdGF0ZS5wcm9tcHREcmFmdCl9PC90ZXh0YXJlYT5cclxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJjb21wb3Nlci1mb290ZXJcIj5cclxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNvbXBvc2VyLWhpbnRcIj4ke3N0YXRlLmxvYWRpbmcgPyBcIlNlYXJjaGluZyBsaXZlIGludmVudG9yeS4uLlwiIDogXCJBc2sgbmF0dXJhbGx5LiBZb3UgY2FuIGFsc28gc2F5IGJvb2sgdGhlIGJlc3Qgb3B0aW9uLlwifTwvZGl2PlxyXG4gICAgICAgICAgICA8YnV0dG9uIGNsYXNzPVwicHJpbWFyeVwiIGlkPVwic2VhcmNoLWJ0blwiICR7c3RhdGUubG9hZGluZyA/IFwiZGlzYWJsZWRcIiA6IFwiXCJ9PlxyXG4gICAgICAgICAgICAgICR7aWNvbihcInNlbmRcIil9XHJcbiAgICAgICAgICAgICAgJHtzdGF0ZS5sb2FkaW5nID8gXCJTZWFyY2hpbmcuLi5cIiA6IFwiU2VhcmNoIGxpdmUgaW52ZW50b3J5XCJ9XHJcbiAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAke3N0YXRlLnNldHRpbmdzSXNzdWVzLmxlbmd0aCA/IGA8ZGl2IGNsYXNzPVwid2FybmluZ1wiPiR7c3RhdGUuc2V0dGluZ3NJc3N1ZXMuam9pbihcIiBcIil9PC9kaXY+YCA6IFwiXCJ9XHJcbiAgICAgICAgPC9kaXY+XHJcbiAgICAgIDwvc2VjdGlvbj5cclxuICAgIDwvZGl2PlxyXG4gIGA7XHJcblxyXG4gIHdpcmVFdmVudHMoKTtcclxufVxyXG5cclxuZnVuY3Rpb24gcmVuZGVyU2V0dGluZ3MoKSB7XHJcbiAgaWYgKCFzdGF0ZS5zZXR0aW5nc09wZW4gfHwgIXN0YXRlLnNldHRpbmdzKSByZXR1cm4gXCJcIjtcclxuXHJcbiAgcmV0dXJuIGBcclxuICAgIDxzZWN0aW9uIGNsYXNzPVwic2V0dGluZ3MtY2FyZFwiPlxyXG4gICAgICA8ZGl2IGNsYXNzPVwic2VjdGlvbi1oZWFkXCI+XHJcbiAgICAgICAgPGgyPlNldHRpbmdzPC9oMj5cclxuICAgICAgICA8c3BhbiBjbGFzcz1cImJhZGdlXCI+U3RvcmVkIGxvY2FsbHk8L3NwYW4+XHJcbiAgICAgIDwvZGl2PlxyXG4gICAgICA8ZGl2IGNsYXNzPVwiZmllbGQtZ3JpZFwiPlxyXG4gICAgICAgIDxsYWJlbD5cclxuICAgICAgICAgIDxzcGFuPlJvdXRlU3RhY2sgQVBJIGtleTwvc3Bhbj5cclxuICAgICAgICAgIDxpbnB1dCBpZD1cInJvdXRlc3RhY2stYXBpLWtleVwiIHZhbHVlPVwiJHtlc2NhcGVBdHRyaWJ1dGUoc3RhdGUuc2V0dGluZ3Mucm91dGVzdGFjay5hcGlLZXkpfVwiIC8+XHJcbiAgICAgICAgPC9sYWJlbD5cclxuICAgICAgICA8bGFiZWw+XHJcbiAgICAgICAgICA8c3Bhbj5Sb3V0ZVN0YWNrIEFQSSBzZWNyZXQ8L3NwYW4+XHJcbiAgICAgICAgICA8aW5wdXQgaWQ9XCJyb3V0ZXN0YWNrLWFwaS1zZWNyZXRcIiB2YWx1ZT1cIiR7ZXNjYXBlQXR0cmlidXRlKHN0YXRlLnNldHRpbmdzLnJvdXRlc3RhY2suYXBpU2VjcmV0KX1cIiAvPlxyXG4gICAgICAgIDwvbGFiZWw+XHJcbiAgICAgICAgPGxhYmVsPlxyXG4gICAgICAgICAgPHNwYW4+TUNQIFVSTDwvc3Bhbj5cclxuICAgICAgICAgIDxpbnB1dCBpZD1cInJvdXRlc3RhY2stbWNwLXVybFwiIHZhbHVlPVwiJHtlc2NhcGVBdHRyaWJ1dGUoc3RhdGUuc2V0dGluZ3Mucm91dGVzdGFjay5tY3BVcmwpfVwiIC8+XHJcbiAgICAgICAgPC9sYWJlbD5cclxuICAgICAgICA8bGFiZWw+XHJcbiAgICAgICAgICA8c3Bhbj5MTE0gcHJvdmlkZXI8L3NwYW4+XHJcbiAgICAgICAgICA8c2VsZWN0IGlkPVwibGxtLXByb3ZpZGVyXCI+XHJcbiAgICAgICAgICAgICR7W1wib3BlbmFpXCIsIFwiYW50aHJvcGljXCIsIFwibWlzdHJhbFwiXVxyXG4gICAgICAgICAgICAgIC5tYXAoXHJcbiAgICAgICAgICAgICAgICAocHJvdmlkZXIpID0+XHJcbiAgICAgICAgICAgICAgICAgIGA8b3B0aW9uIHZhbHVlPVwiJHtwcm92aWRlcn1cIiAke3N0YXRlLnNldHRpbmdzPy5sbG0ucHJvdmlkZXIgPT09IHByb3ZpZGVyID8gXCJzZWxlY3RlZFwiIDogXCJcIn0+JHtwcm92aWRlcn08L29wdGlvbj5gLFxyXG4gICAgICAgICAgICAgIClcclxuICAgICAgICAgICAgICAuam9pbihcIlwiKX1cclxuICAgICAgICAgIDwvc2VsZWN0PlxyXG4gICAgICAgIDwvbGFiZWw+XHJcbiAgICAgICAgPGxhYmVsPlxyXG4gICAgICAgICAgPHNwYW4+T3BlbkFJIGtleTwvc3Bhbj5cclxuICAgICAgICAgIDxpbnB1dCBpZD1cIm9wZW5haS1hcGkta2V5XCIgdmFsdWU9XCIke2VzY2FwZUF0dHJpYnV0ZShzdGF0ZS5zZXR0aW5ncy5sbG0ub3BlbmFpLmFwaUtleSl9XCIgLz5cclxuICAgICAgICA8L2xhYmVsPlxyXG4gICAgICAgIDxsYWJlbD5cclxuICAgICAgICAgIDxzcGFuPk9wZW5BSSBtb2RlbDwvc3Bhbj5cclxuICAgICAgICAgIDxpbnB1dCBpZD1cIm9wZW5haS1tb2RlbFwiIHZhbHVlPVwiJHtlc2NhcGVBdHRyaWJ1dGUoc3RhdGUuc2V0dGluZ3MubGxtLm9wZW5haS5tb2RlbCl9XCIgLz5cclxuICAgICAgICA8L2xhYmVsPlxyXG4gICAgICAgIDxsYWJlbD5cclxuICAgICAgICAgIDxzcGFuPkFudGhyb3BpYyBrZXk8L3NwYW4+XHJcbiAgICAgICAgICA8aW5wdXQgaWQ9XCJhbnRocm9waWMtYXBpLWtleVwiIHZhbHVlPVwiJHtlc2NhcGVBdHRyaWJ1dGUoc3RhdGUuc2V0dGluZ3MubGxtLmFudGhyb3BpYy5hcGlLZXkpfVwiIC8+XHJcbiAgICAgICAgPC9sYWJlbD5cclxuICAgICAgICA8bGFiZWw+XHJcbiAgICAgICAgICA8c3Bhbj5BbnRocm9waWMgbW9kZWw8L3NwYW4+XHJcbiAgICAgICAgICA8aW5wdXQgaWQ9XCJhbnRocm9waWMtbW9kZWxcIiB2YWx1ZT1cIiR7ZXNjYXBlQXR0cmlidXRlKHN0YXRlLnNldHRpbmdzLmxsbS5hbnRocm9waWMubW9kZWwpfVwiIC8+XHJcbiAgICAgICAgPC9sYWJlbD5cclxuICAgICAgICA8bGFiZWw+XHJcbiAgICAgICAgICA8c3Bhbj5NaXN0cmFsIGtleTwvc3Bhbj5cclxuICAgICAgICAgIDxpbnB1dCBpZD1cIm1pc3RyYWwtYXBpLWtleVwiIHZhbHVlPVwiJHtlc2NhcGVBdHRyaWJ1dGUoc3RhdGUuc2V0dGluZ3MubGxtLm1pc3RyYWwuYXBpS2V5KX1cIiAvPlxyXG4gICAgICAgIDwvbGFiZWw+XHJcbiAgICAgICAgPGxhYmVsPlxyXG4gICAgICAgICAgPHNwYW4+TWlzdHJhbCBtb2RlbDwvc3Bhbj5cclxuICAgICAgICAgIDxpbnB1dCBpZD1cIm1pc3RyYWwtbW9kZWxcIiB2YWx1ZT1cIiR7ZXNjYXBlQXR0cmlidXRlKHN0YXRlLnNldHRpbmdzLmxsbS5taXN0cmFsLm1vZGVsKX1cIiAvPlxyXG4gICAgICAgIDwvbGFiZWw+XHJcbiAgICAgICAgPGxhYmVsPlxyXG4gICAgICAgICAgPHNwYW4+TWlzdHJhbCBiYXNlIFVSTDwvc3Bhbj5cclxuICAgICAgICAgIDxpbnB1dCBpZD1cIm1pc3RyYWwtYmFzZS11cmxcIiB2YWx1ZT1cIiR7ZXNjYXBlQXR0cmlidXRlKHN0YXRlLnNldHRpbmdzLmxsbS5taXN0cmFsLmJhc2VVcmwpfVwiIC8+XHJcbiAgICAgICAgPC9sYWJlbD5cclxuICAgICAgPC9kaXY+XHJcbiAgICAgIDxkaXYgY2xhc3M9XCJhY3Rpb24tcm93XCI+XHJcbiAgICAgICAgPGJ1dHRvbiBjbGFzcz1cInByaW1hcnlcIiBpZD1cInNhdmUtc2V0dGluZ3MtYnRuXCI+JHtpY29uKFwic2F2ZVwiKX1TYXZlIHNldHRpbmdzPC9idXR0b24+XHJcbiAgICAgIDwvZGl2PlxyXG4gICAgPC9zZWN0aW9uPlxyXG4gIGA7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJlbmRlckRpYWdub3N0aWNzVG9nZ2xlKCkge1xyXG4gIGlmICghc3RhdGUudG9vbENhbGxzLmxlbmd0aCkgcmV0dXJuIFwiXCI7XHJcblxyXG4gIHJldHVybiBgXHJcbiAgICA8YnV0dG9uIGNsYXNzPVwiZ2hvc3QgZ2hvc3QtY29tcGFjdFwiIGlkPVwiZGlhZ25vc3RpY3MtdG9nZ2xlXCI+XHJcbiAgICAgICR7aWNvbihcInRyYWNlXCIpfVxyXG4gICAgICAke3N0YXRlLmRpYWdub3N0aWNzT3BlbiA/IFwiSGlkZSB0cmFjZVwiIDogYFRyYWNlICgke3N0YXRlLnRvb2xDYWxscy5sZW5ndGh9KWB9XHJcbiAgICA8L2J1dHRvbj5cclxuICBgO1xyXG59XHJcblxyXG5mdW5jdGlvbiByZW5kZXJEaWFnbm9zdGljcygpIHtcclxuICBpZiAoIXN0YXRlLnRvb2xDYWxscy5sZW5ndGggfHwgIXN0YXRlLmRpYWdub3N0aWNzT3BlbikgcmV0dXJuIFwiXCI7XHJcblxyXG4gIHJldHVybiBgXHJcbiAgICA8c2VjdGlvbiBjbGFzcz1cInRyYWNlLWNhcmRcIj5cclxuICAgICAgPGRpdiBjbGFzcz1cInRyYWNlLWxpc3RcIj5cclxuICAgICAgICAke3N0YXRlLnRvb2xDYWxsc1xyXG4gICAgICAgICAgLm1hcChcclxuICAgICAgICAgICAgKHRvb2xDYWxsKSA9PiBgXHJcbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRyYWNlLXJvd1wiPlxyXG4gICAgICAgICAgICAgICAgPHN0cm9uZz4ke2VzY2FwZUh0bWwodG9vbENhbGwubmFtZSl9PC9zdHJvbmc+XHJcbiAgICAgICAgICAgICAgICA8c3Bhbj4ke2VzY2FwZUh0bWwodG9vbENhbGwuc3VtbWFyeSl9PC9zcGFuPlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICBgLFxyXG4gICAgICAgICAgKVxyXG4gICAgICAgICAgLmpvaW4oXCJcIil9XHJcbiAgICAgIDwvZGl2PlxyXG4gICAgPC9zZWN0aW9uPlxyXG4gIGA7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJlbmRlclVuaWZpZWRSZXN1bHRzKCkge1xyXG4gIGlmICghc3RhdGUucmVzdWx0U2VjdGlvbnMubGVuZ3RoKSB7XHJcbiAgICByZXR1cm4gYFxyXG4gICAgICA8c2VjdGlvbiBjbGFzcz1cInJlc3VsdHMtc3RyZWFtIGVtcHR5LXN0YXRlXCI+XHJcbiAgICAgICAgPGRpdiBjbGFzcz1cImVtcHR5LWlsbHVzdHJhdGlvblwiPiR7aWNvbihcImVtcHR5XCIpfTwvZGl2PlxyXG4gICAgICAgIDxoMz5SZXN1bHRzIHdpbGwgbGFuZCBoZXJlPC9oMz5cclxuICAgICAgICA8cD5PbmNlIHRoZSBhc3Npc3RhbnQgZmluZHMgbGl2ZSBpbnZlbnRvcnksIHlvdSdsbCBnZXQgb3B0aW9ucyB5b3UgY2FuIG9wZW4gb3IgdXNlIGFzIHRoZSBuZXh0IHN0ZXAgaW4gdGhlIGNvbnZlcnNhdGlvbi48L3A+XHJcbiAgICAgIDwvc2VjdGlvbj5cclxuICAgIGA7XHJcbiAgfVxyXG5cclxuICByZXR1cm4gYFxyXG4gICAgPHNlY3Rpb24gY2xhc3M9XCJyZXN1bHRzLXN0cmVhbVwiPlxyXG4gICAgICAke3N0YXRlLnJlc3VsdFNlY3Rpb25zXHJcbiAgICAgICAgLm1hcChcclxuICAgICAgICAgIChzZWN0aW9uKSA9PiBgXHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJyZXN1bHQtZ3JvdXBcIj5cclxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwic2VjdGlvbi1oZWFkXCI+XHJcbiAgICAgICAgICAgICAgICA8aDM+JHtpY29uKHNlY3Rpb24ua2luZCl9JHtlc2NhcGVIdG1sKHNlY3Rpb24udGl0bGUpfTwvaDM+XHJcbiAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cImJhZGdlIGJhZGdlLSR7c2VjdGlvbi5raW5kfVwiPiR7c2VjdGlvbi5pdGVtcy5sZW5ndGh9IG9wdGlvbnM8L3NwYW4+XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInJlc3VsdC1ncmlkXCI+XHJcbiAgICAgICAgICAgICAgICAke3NlY3Rpb24uaXRlbXMubWFwKChpdGVtKSA9PiByZW5kZXJSZXN1bHRDYXJkKGl0ZW0sIHNlY3Rpb24pKS5qb2luKFwiXCIpfVxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgIGAsXHJcbiAgICAgICAgKVxyXG4gICAgICAgIC5qb2luKFwiXCIpfVxyXG4gICAgPC9zZWN0aW9uPlxyXG4gIGA7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJlbmRlclJlc3VsdENhcmQoaXRlbTogUmVzdWx0SXRlbSwgc2VjdGlvbjogUmVzdWx0U2VjdGlvbikge1xyXG4gIGNvbnN0IGZvbGxvd1VwID0gYnVpbGRGb2xsb3dVcChpdGVtLCBzZWN0aW9uKTtcclxuICBjb25zdCByb290VGFnID0gaXRlbS5jdGFVcmwgPyBcImFcIiA6IFwiYXJ0aWNsZVwiO1xyXG4gIGNvbnN0IHJvb3RBdHRyaWJ1dGVzID0gaXRlbS5jdGFVcmxcclxuICAgID8gYGhyZWY9XCIke2VzY2FwZUF0dHJpYnV0ZShpdGVtLmN0YVVybCl9XCIgdGFyZ2V0PVwiX2JsYW5rXCIgcmVsPVwibm9yZWZlcnJlclwiIGNsYXNzPVwicmVzdWx0LWNhcmQgcmVzdWx0LWNhcmQtbGluayByZXN1bHQtY2FyZC0ke2l0ZW0uYWNjZW50ID8/IHNlY3Rpb24ua2luZH1cImBcclxuICAgIDogYGNsYXNzPVwicmVzdWx0LWNhcmQgcmVzdWx0LWNhcmQtJHtpdGVtLmFjY2VudCA/PyBzZWN0aW9uLmtpbmR9XCJgO1xyXG5cclxuICByZXR1cm4gYFxyXG4gICAgPCR7cm9vdFRhZ30gJHtyb290QXR0cmlidXRlc30+XHJcbiAgICAgICR7aXRlbS5pbWFnZVVybCA/IGA8ZGl2IGNsYXNzPVwicmVzdWx0LWltYWdlXCIgc3R5bGU9XCJiYWNrZ3JvdW5kLWltYWdlOnVybCgnJHtlc2NhcGVBdHRyaWJ1dGUoaXRlbS5pbWFnZVVybCl9JylcIj48L2Rpdj5gIDogXCJcIn1cclxuICAgICAgPGRpdiBjbGFzcz1cInJlc3VsdC1ib2R5XCI+XHJcbiAgICAgICAgPGRpdiBjbGFzcz1cInJlc3VsdC10b3BcIj5cclxuICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgIDxoND4ke2VzY2FwZUh0bWwoaXRlbS50aXRsZSl9PC9oND5cclxuICAgICAgICAgICAgJHtpdGVtLnN1YnRpdGxlID8gYDxwIGNsYXNzPVwic3VidGl0bGVcIj4ke2VzY2FwZUh0bWwoaXRlbS5zdWJ0aXRsZSl9PC9wPmAgOiBcIlwifVxyXG4gICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAke2l0ZW0ucHJpY2UgPyBgPHN0cm9uZyBjbGFzcz1cInByaWNlXCI+JHtlc2NhcGVIdG1sKGl0ZW0ucHJpY2UpfTwvc3Ryb25nPmAgOiBcIlwifVxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICAgICR7XHJcbiAgICAgICAgICBpdGVtLm1ldGE/Lmxlbmd0aFxyXG4gICAgICAgICAgICA/IGA8ZGl2IGNsYXNzPVwibWV0YS1yb3dcIj4ke2l0ZW0ubWV0YS5tYXAoKG1ldGEpID0+IGA8c3Bhbj4ke2VzY2FwZUh0bWwobWV0YSl9PC9zcGFuPmApLmpvaW4oXCJcIil9PC9kaXY+YFxyXG4gICAgICAgICAgICA6IFwiXCJcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgICR7aXRlbS5kZXNjcmlwdGlvbiA/IGA8ZGl2IGNsYXNzPVwiZGVzY3JpcHRpb24gbWFya2Rvd24tYm9keVwiPiR7cmVuZGVyUmljaFRleHQoaXRlbS5kZXNjcmlwdGlvbil9PC9kaXY+YCA6IFwiXCJ9XHJcbiAgICAgICAgPGRpdiBjbGFzcz1cImNhcmQtYWN0aW9uc1wiPlxyXG4gICAgICAgICAgJHtcclxuICAgICAgICAgICAgaXRlbS5jdGFVcmxcclxuICAgICAgICAgICAgICA/IGA8c3BhbiBjbGFzcz1cImNhcmQtbGluay1oaW50XCI+JHtpY29uKFwib3BlblwiKX0gJHtlc2NhcGVIdG1sKGl0ZW0uY3RhTGFiZWwgPz8gXCJPcGVuIG9wdGlvblwiKX08L3NwYW4+YFxyXG4gICAgICAgICAgICAgIDogYDxidXR0b24gY2xhc3M9XCJnaG9zdCBnaG9zdC1jb21wYWN0IHJlc3VsdC1hY3Rpb25cIiBkYXRhLWZvbGxvd3VwPVwiJHtlc2NhcGVBdHRyaWJ1dGUoZm9sbG93VXApfVwiPiR7aWNvbihcInVzZVwiKX1Vc2UgdGhpcyBvcHRpb248L2J1dHRvbj5gXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICA8YnV0dG9uIGNsYXNzPVwiZ2hvc3QgZ2hvc3QtY29tcGFjdCByZXN1bHQtYWN0aW9uXCIgZGF0YS1mb2xsb3d1cD1cIiR7ZXNjYXBlQXR0cmlidXRlKGZvbGxvd1VwKX1cIj4ke2ljb24oXCJzcGFya1wiKX1Bc2sgYWJvdXQgdGhpczwvYnV0dG9uPlxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICA8L2Rpdj5cclxuICAgIDwvJHtyb290VGFnfT5cclxuICBgO1xyXG59XHJcblxyXG5mdW5jdGlvbiBidWlsZEZvbGxvd1VwKGl0ZW06IFJlc3VsdEl0ZW0sIHNlY3Rpb246IFJlc3VsdFNlY3Rpb24pIHtcclxuICBjb25zdCBzdWJqZWN0ID0gaXRlbS50aXRsZSB8fCBzZWN0aW9uLnRpdGxlO1xyXG4gIGlmIChzZWN0aW9uLmtpbmQgPT09IFwiaG90ZWxcIikgcmV0dXJuIGBTaG93IG1lIG1vcmUgZGV0YWlscyBmb3IgJHtzdWJqZWN0fSBhbmQgaGVscCBtZSBib29rIGl0LmA7XHJcbiAgaWYgKHNlY3Rpb24ua2luZCA9PT0gXCJmbGlnaHRcIikgcmV0dXJuIGBDb21wYXJlIHRoaXMgZmxpZ2h0IG9wdGlvbjogJHtzdWJqZWN0fSwgdGhlbiBoZWxwIG1lIGJvb2sgdGhlIGJlc3Qgb25lLmA7XHJcbiAgaWYgKHNlY3Rpb24ua2luZCA9PT0gXCJjYXJcIikge1xyXG4gICAgcmV0dXJuIGl0ZW0uZmFyZUNvZGVcclxuICAgICAgPyBgUmV2YWxpZGF0ZSBhbmQgYm9vayB0aGlzIGNhcjogJHtzdWJqZWN0fSAoZmFyZUNvZGU6ICR7aXRlbS5mYXJlQ29kZX0pLmBcclxuICAgICAgOiBgU2hvdyBtZSBtb3JlIGRldGFpbHMgZm9yIHRoaXMgY2FyIG9wdGlvbjogJHtzdWJqZWN0fSBhbmQgaGVscCBtZSBib29rIGl0LmA7XHJcbiAgfVxyXG4gIGlmIChzZWN0aW9uLmtpbmQgPT09IFwiYm9va2luZ1wiKSByZXR1cm4gYENvbnRpbnVlIHdpdGggJHtzdWJqZWN0fS5gO1xyXG4gIHJldHVybiBgVGVsbCBtZSBtb3JlIGFib3V0ICR7c3ViamVjdH0uYDtcclxufVxyXG5cclxuZnVuY3Rpb24gd2lyZUV2ZW50cygpIHtcclxuICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiI3NldHRpbmdzLXRvZ2dsZVwiKT8uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcclxuICAgIHN0YXRlLnNldHRpbmdzT3BlbiA9ICFzdGF0ZS5zZXR0aW5nc09wZW47XHJcbiAgICByZW5kZXIoKTtcclxuICB9KTtcclxuXHJcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIiNkaWFnbm9zdGljcy10b2dnbGVcIik/LmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XHJcbiAgICBzdGF0ZS5kaWFnbm9zdGljc09wZW4gPSAhc3RhdGUuZGlhZ25vc3RpY3NPcGVuO1xyXG4gICAgcmVuZGVyKCk7XHJcbiAgfSk7XHJcblxyXG4gIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEJ1dHRvbkVsZW1lbnQ+KFwiW2RhdGEtbW9kZV1cIikuZm9yRWFjaCgoYnV0dG9uKSA9PiB7XHJcbiAgICBidXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcclxuICAgICAgc3RhdGUuc2VhcmNoTW9kZSA9IGJ1dHRvbi5kYXRhc2V0Lm1vZGUgYXMgdHlwZW9mIHN0YXRlLnNlYXJjaE1vZGU7XHJcbiAgICAgIHJlbmRlcigpO1xyXG4gICAgfSk7XHJcbiAgfSk7XHJcblxyXG4gIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIjcHJvbXB0XCIpPy5hZGRFdmVudExpc3RlbmVyKFwiaW5wdXRcIiwgKGV2ZW50KSA9PiB7XHJcbiAgICBzdGF0ZS5wcm9tcHREcmFmdCA9IChldmVudC50YXJnZXQgYXMgSFRNTFRleHRBcmVhRWxlbWVudCkudmFsdWU7XHJcbiAgfSk7XHJcblxyXG4gIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIjc2VhcmNoLWJ0blwiKT8uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGFzeW5jICgpID0+IHtcclxuICAgIGNvbnN0IHByb21wdCA9IHN0YXRlLnByb21wdERyYWZ0LnRyaW0oKSB8fCBidWlsZFBhZ2VEcml2ZW5Qcm9tcHQoc3RhdGUuc2VhcmNoTW9kZSwgc3RhdGUucGFnZUNvbnRleHQpO1xyXG4gICAgaWYgKCFwcm9tcHQpIHtcclxuICAgICAgc3RhdGUuYXNzaXN0YW50TWVzc2FnZSA9IFwiQWRkIGEgcmVxdWVzdCBvciBvcGVuIGEgdHJhdmVsLXJlbGF0ZWQgcGFnZSBzbyBJIGNhbiBzZWFyY2ggbGl2ZSBpbnZlbnRvcnkuXCI7XHJcbiAgICAgIHJlbmRlcigpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgc3RhdGUubG9hZGluZyA9IHRydWU7XHJcbiAgICBzdGF0ZS5hc3Npc3RhbnRNZXNzYWdlID0gYFNlYXJjaGluZyAke3N0YXRlLnNlYXJjaE1vZGV9Li4uYDtcclxuICAgIHJlbmRlcigpO1xyXG5cclxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgc2VuZFJlcXVlc3Qoe1xyXG4gICAgICB0eXBlOiBcIlJPVVRFU1RBQ0tfQ0hBVFwiLFxyXG4gICAgICB0YWJJZDogc3RhdGUudGFiSWQsXHJcbiAgICAgIHByb21wdCxcclxuICAgICAgc2VhcmNoTW9kZTogc3RhdGUuc2VhcmNoTW9kZSxcclxuICAgIH0pO1xyXG5cclxuICAgIHN0YXRlLmxvYWRpbmcgPSBmYWxzZTtcclxuXHJcbiAgICBpZiAocmVzcG9uc2Uub2spIHtcclxuICAgICAgYXBwbHlQYXlsb2FkKHJlc3BvbnNlKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHN0YXRlLmFzc2lzdGFudE1lc3NhZ2UgPSByZXNwb25zZS5lcnJvcjtcclxuICAgICAgc3RhdGUuc2V0dGluZ3MgPSByZXNwb25zZS5zZXR0aW5ncyA/PyBzdGF0ZS5zZXR0aW5ncztcclxuICAgIH1cclxuXHJcbiAgICByZW5kZXIoKTtcclxuICB9KTtcclxuXHJcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbDxIVE1MQnV0dG9uRWxlbWVudD4oXCIucmVzdWx0LWFjdGlvblwiKS5mb3JFYWNoKChidXR0b24pID0+IHtcclxuICAgIGJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xyXG4gICAgICBzdGF0ZS5wcm9tcHREcmFmdCA9IGJ1dHRvbi5kYXRhc2V0LmZvbGxvd3VwID8/IFwiXCI7XHJcbiAgICAgIHJlbmRlcigpO1xyXG4gICAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yPEhUTUxUZXh0QXJlYUVsZW1lbnQ+KFwiI3Byb21wdFwiKT8uZm9jdXMoKTtcclxuICAgIH0pO1xyXG4gIH0pO1xyXG5cclxuICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiI3Jlc2V0LWJ0blwiKT8uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGFzeW5jICgpID0+IHtcclxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgc2VuZFJlcXVlc3Qoe1xyXG4gICAgICB0eXBlOiBcIlJPVVRFU1RBQ0tfUkVTRVRcIixcclxuICAgICAgdGFiSWQ6IHN0YXRlLnRhYklkLFxyXG4gICAgfSk7XHJcblxyXG4gICAgaWYgKHJlc3BvbnNlLm9rKSB7XHJcbiAgICAgIGFwcGx5UGF5bG9hZChyZXNwb25zZSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBzdGF0ZS5hc3Npc3RhbnRNZXNzYWdlID0gcmVzcG9uc2UuZXJyb3I7XHJcbiAgICB9XHJcblxyXG4gICAgc3RhdGUucHJvbXB0RHJhZnQgPSBcIlwiO1xyXG4gICAgcmVuZGVyKCk7XHJcbiAgfSk7XHJcblxyXG4gIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIjc2F2ZS1zZXR0aW5ncy1idG5cIik/LmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBhc3luYyAoKSA9PiB7XHJcbiAgICBjb25zdCBzZXR0aW5ncyA9IGNvbGxlY3RTZXR0aW5nc0Zvcm0oKTtcclxuICAgIHN0YXRlLnNldHRpbmdzID0gYXdhaXQgc2F2ZVNldHRpbmdzKHNldHRpbmdzKTtcclxuICAgIHN0YXRlLnNldHRpbmdzSXNzdWVzID0gW107XHJcbiAgICBzdGF0ZS5hc3Npc3RhbnRNZXNzYWdlID0gXCJTZXR0aW5ncyBzYXZlZC4gWW91IGNhbiBydW4gYSBsaXZlIHNlYXJjaCBub3cuXCI7XHJcbiAgICByZW5kZXIoKTtcclxuICB9KTtcclxufVxyXG5cclxuZnVuY3Rpb24gY29sbGVjdFNldHRpbmdzRm9ybSgpOiBQYXJ0aWFsPEV4dGVuc2lvblNldHRpbmdzPiB7XHJcbiAgcmV0dXJuIHtcclxuICAgIHJvdXRlc3RhY2s6IHtcclxuICAgICAgYXBpS2V5OiB2YWx1ZU9mKFwiI3JvdXRlc3RhY2stYXBpLWtleVwiKSxcclxuICAgICAgYXBpU2VjcmV0OiB2YWx1ZU9mKFwiI3JvdXRlc3RhY2stYXBpLXNlY3JldFwiKSxcclxuICAgICAgbWNwVXJsOiB2YWx1ZU9mKFwiI3JvdXRlc3RhY2stbWNwLXVybFwiKSxcclxuICAgIH0sXHJcbiAgICBsbG06IHtcclxuICAgICAgcHJvdmlkZXI6IHZhbHVlT2YoXCIjbGxtLXByb3ZpZGVyXCIpIGFzIEV4dGVuc2lvblNldHRpbmdzW1wibGxtXCJdW1wicHJvdmlkZXJcIl0sXHJcbiAgICAgIG9wZW5haToge1xyXG4gICAgICAgIGFwaUtleTogdmFsdWVPZihcIiNvcGVuYWktYXBpLWtleVwiKSxcclxuICAgICAgICBtb2RlbDogdmFsdWVPZihcIiNvcGVuYWktbW9kZWxcIiksXHJcbiAgICAgIH0sXHJcbiAgICAgIGFudGhyb3BpYzoge1xyXG4gICAgICAgIGFwaUtleTogdmFsdWVPZihcIiNhbnRocm9waWMtYXBpLWtleVwiKSxcclxuICAgICAgICBtb2RlbDogdmFsdWVPZihcIiNhbnRocm9waWMtbW9kZWxcIiksXHJcbiAgICAgIH0sXHJcbiAgICAgIG1pc3RyYWw6IHtcclxuICAgICAgICBhcGlLZXk6IHZhbHVlT2YoXCIjbWlzdHJhbC1hcGkta2V5XCIpLFxyXG4gICAgICAgIG1vZGVsOiB2YWx1ZU9mKFwiI21pc3RyYWwtbW9kZWxcIiksXHJcbiAgICAgICAgYmFzZVVybDogdmFsdWVPZihcIiNtaXN0cmFsLWJhc2UtdXJsXCIpLFxyXG4gICAgICB9LFxyXG4gICAgfSxcclxuICB9O1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBzZW5kUmVxdWVzdChyZXF1ZXN0OiBQYW5lbFJlcXVlc3QpOiBQcm9taXNlPFBhbmVsUmVzcG9uc2U+IHtcclxuICByZXR1cm4gY2hyb21lLnJ1bnRpbWUuc2VuZE1lc3NhZ2UocmVxdWVzdCkgYXMgUHJvbWlzZTxQYW5lbFJlc3BvbnNlPjtcclxufVxyXG5cclxuZnVuY3Rpb24gYXBwbHlQYXlsb2FkKHJlc3BvbnNlOiBFeHRyYWN0PFBhbmVsUmVzcG9uc2UsIHsgb2s6IHRydWUgfT4pIHtcclxuICBzdGF0ZS5wYWdlQ29udGV4dCA9IHJlc3BvbnNlLnBheWxvYWQucGFnZUNvbnRleHQ7XHJcbiAgc3RhdGUuYXNzaXN0YW50TWVzc2FnZSA9IHJlc3BvbnNlLnBheWxvYWQuYXNzaXN0YW50TWVzc2FnZTtcclxuICBzdGF0ZS5yZXN1bHRTZWN0aW9ucyA9IHJlc3BvbnNlLnBheWxvYWQucmVzdWx0U2VjdGlvbnM7XHJcbiAgc3RhdGUudG9vbENhbGxzID0gcmVzcG9uc2UucGF5bG9hZC50b29sQ2FsbHMubWFwKCh0b29sQ2FsbCkgPT4gKHtcclxuICAgIG5hbWU6IHRvb2xDYWxsLm5hbWUsXHJcbiAgICBzdW1tYXJ5OiB0b29sQ2FsbC5zdW1tYXJ5LFxyXG4gIH0pKTtcclxuICBzdGF0ZS5zZXR0aW5nc0lzc3VlcyA9IHJlc3BvbnNlLnBheWxvYWQuc2V0dGluZ3NJc3N1ZXM7XHJcbiAgc3RhdGUuc2V0dGluZ3MgPSByZXNwb25zZS5zZXR0aW5ncztcclxuXHJcbiAgaWYgKCFyZXNwb25zZS5wYXlsb2FkLnBhZ2VDb250ZXh0KSB7XHJcbiAgICBzdGF0ZS5wYWdlU3VtbWFyeSA9IFwiXCI7XHJcbiAgICByZXR1cm47XHJcbiAgfVxyXG5cclxuICBjb25zdCBoaW50cyA9IHJlc3BvbnNlLnBheWxvYWQucGFnZUNvbnRleHQudHJhdmVsSGludHMuam9pbihcIiB8IFwiKSB8fCBcIk5vIHRyYXZlbCBoaW50cyBmb3VuZCBvbiB0aGUgcGFnZS5cIjtcclxuICBzdGF0ZS5wYWdlU3VtbWFyeSA9IGAke3Jlc3BvbnNlLnBheWxvYWQucGFnZUNvbnRleHQudGl0bGV9IHwgJHtoaW50c31gO1xyXG5cclxuICBpZiAoIXN0YXRlLnByb21wdERyYWZ0LnRyaW0oKSkge1xyXG4gICAgY29uc3QgaW5mZXJyZWRNb2RlID0gaW5mZXJTZWFyY2hNb2RlRnJvbVBhZ2VDb250ZXh0KHJlc3BvbnNlLnBheWxvYWQucGFnZUNvbnRleHQpO1xyXG4gICAgc3RhdGUuc2VhcmNoTW9kZSA9IGluZmVycmVkTW9kZTtcclxuICAgIHN0YXRlLnByb21wdERyYWZ0ID0gYnVpbGRQYWdlRHJpdmVuUHJvbXB0KGluZmVycmVkTW9kZSwgcmVzcG9uc2UucGF5bG9hZC5wYWdlQ29udGV4dCk7XHJcbiAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiB2YWx1ZU9mKHNlbGVjdG9yOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gIGNvbnN0IGVsZW1lbnQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yPEhUTUxJbnB1dEVsZW1lbnQgfCBIVE1MU2VsZWN0RWxlbWVudD4oc2VsZWN0b3IpO1xyXG4gIHJldHVybiBlbGVtZW50Py52YWx1ZS50cmltKCkgPz8gXCJcIjtcclxufVxyXG5cclxuZnVuY3Rpb24gY2FwaXRhbGl6ZSh2YWx1ZTogc3RyaW5nKSB7XHJcbiAgcmV0dXJuIHZhbHVlLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgdmFsdWUuc2xpY2UoMSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGVzY2FwZUh0bWwodmFsdWU6IHN0cmluZykge1xyXG4gIHJldHVybiB2YWx1ZVxyXG4gICAgLnJlcGxhY2VBbGwoXCImXCIsIFwiJmFtcDtcIilcclxuICAgIC5yZXBsYWNlQWxsKFwiPFwiLCBcIiZsdDtcIilcclxuICAgIC5yZXBsYWNlQWxsKFwiPlwiLCBcIiZndDtcIilcclxuICAgIC5yZXBsYWNlQWxsKCdcIicsIFwiJnF1b3Q7XCIpXHJcbiAgICAucmVwbGFjZUFsbChcIidcIiwgXCImIzM5O1wiKTtcclxufVxyXG5cclxuZnVuY3Rpb24gcmVuZGVySHRtbERlc2NyaXB0aW9uKHZhbHVlOiBzdHJpbmcpIHtcclxuICBjb25zdCB0ZW1wbGF0ZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJ0ZW1wbGF0ZVwiKTtcclxuICB0ZW1wbGF0ZS5pbm5lckhUTUwgPSB2YWx1ZTtcclxuXHJcbiAgY29uc3QgYWxsb3dlZFRhZ3MgPSBuZXcgU2V0KFtcclxuICAgIFwiUFwiLFxyXG4gICAgXCJCUlwiLFxyXG4gICAgXCJTVFJPTkdcIixcclxuICAgIFwiQlwiLFxyXG4gICAgXCJFTVwiLFxyXG4gICAgXCJJXCIsXHJcbiAgICBcIlVMXCIsXHJcbiAgICBcIk9MXCIsXHJcbiAgICBcIkxJXCIsXHJcbiAgXSk7XHJcblxyXG4gIGNvbnN0IHNhbml0aXplTm9kZSA9IChub2RlOiBOb2RlKTogc3RyaW5nID0+IHtcclxuICAgIGlmIChub2RlLm5vZGVUeXBlID09PSBOb2RlLlRFWFRfTk9ERSkge1xyXG4gICAgICByZXR1cm4gZXNjYXBlSHRtbChub2RlLnRleHRDb250ZW50ID8/IFwiXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChub2RlLm5vZGVUeXBlICE9PSBOb2RlLkVMRU1FTlRfTk9ERSkge1xyXG4gICAgICByZXR1cm4gXCJcIjtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBlbGVtZW50ID0gbm9kZSBhcyBIVE1MRWxlbWVudDtcclxuICAgIGNvbnN0IHRhZyA9IGVsZW1lbnQudGFnTmFtZS50b1VwcGVyQ2FzZSgpO1xyXG5cclxuICAgIGNvbnN0IGNoaWxkcmVuID0gQXJyYXkuZnJvbShlbGVtZW50LmNoaWxkTm9kZXMpXHJcbiAgICAgIC5tYXAoKGNoaWxkKSA9PiBzYW5pdGl6ZU5vZGUoY2hpbGQpKVxyXG4gICAgICAuam9pbihcIlwiKTtcclxuXHJcbiAgICBpZiAoIWFsbG93ZWRUYWdzLmhhcyh0YWcpKSB7XHJcbiAgICAgIHJldHVybiBjaGlsZHJlbjtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCB0YWdOYW1lID0gdGFnLnRvTG93ZXJDYXNlKCk7XHJcbiAgICByZXR1cm4gYDwke3RhZ05hbWV9PiR7Y2hpbGRyZW59PC8ke3RhZ05hbWV9PmA7XHJcbiAgfTtcclxuXHJcbiAgcmV0dXJuIEFycmF5LmZyb20odGVtcGxhdGUuY29udGVudC5jaGlsZE5vZGVzKVxyXG4gICAgLm1hcCgobm9kZSkgPT4gc2FuaXRpemVOb2RlKG5vZGUpKVxyXG4gICAgLmpvaW4oXCJcIik7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGVzY2FwZUF0dHJpYnV0ZSh2YWx1ZTogc3RyaW5nKSB7XHJcbiAgcmV0dXJuIGVzY2FwZUh0bWwodmFsdWUpO1xyXG59XHJcblxyXG5mdW5jdGlvbiByZW5kZXJSaWNoVGV4dCh2YWx1ZTogc3RyaW5nKSB7XHJcbiAgY29uc3QgYmxvY2tzID0gdmFsdWUucmVwbGFjZSgvXFxyXFxuL2csIFwiXFxuXCIpLnNwbGl0KC9cXG57Mix9LykubWFwKChibG9jaykgPT4gYmxvY2sudHJpbSgpKS5maWx0ZXIoQm9vbGVhbik7XHJcbiAgcmV0dXJuIGJsb2Nrcy5tYXAocmVuZGVyQmxvY2spLmpvaW4oXCJcIik7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJlbmRlckJsb2NrKGJsb2NrOiBzdHJpbmcpIHtcclxuICBjb25zdCBsaW5lcyA9IGJsb2NrLnNwbGl0KFwiXFxuXCIpLm1hcCgobGluZSkgPT4gbGluZS50cmltKCkpLmZpbHRlcihCb29sZWFuKTtcclxuICBpZiAoIWxpbmVzLmxlbmd0aCkgcmV0dXJuIFwiXCI7XHJcblxyXG4gIGlmIChsaW5lcy5ldmVyeSgobGluZSkgPT4gL15bLSpcdTIwMjJdXFxzKy8udGVzdChsaW5lKSkpIHtcclxuICAgIHJldHVybiBgPHVsPiR7bGluZXMubWFwKChsaW5lKSA9PiBgPGxpPiR7cmVuZGVySW5saW5lKGxpbmUucmVwbGFjZSgvXlstKlx1MjAyMl1cXHMrLywgXCJcIikpfTwvbGk+YCkuam9pbihcIlwiKX08L3VsPmA7XHJcbiAgfVxyXG5cclxuICBpZiAobGluZXMuZXZlcnkoKGxpbmUpID0+IC9eXFxkK1xcLlxccysvLnRlc3QobGluZSkpKSB7XHJcbiAgICByZXR1cm4gYDxvbD4ke2xpbmVzLm1hcCgobGluZSkgPT4gYDxsaT4ke3JlbmRlcklubGluZShsaW5lLnJlcGxhY2UoL15cXGQrXFwuXFxzKy8sIFwiXCIpKX08L2xpPmApLmpvaW4oXCJcIil9PC9vbD5gO1xyXG4gIH1cclxuXHJcbiAgcmV0dXJuIGA8cD4ke2xpbmVzLm1hcChyZW5kZXJJbmxpbmUpLmpvaW4oXCI8YnIgLz5cIil9PC9wPmA7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJlbmRlcklubGluZSh2YWx1ZTogc3RyaW5nKSB7XHJcbiAgY29uc3QgaW1hZ2VQYXR0ZXJuID0gLyFcXFsoW15cXF1dKilcXF1cXCgoaHR0cHM/OlxcL1xcL1teXFxzKV0rKVxcKS9nO1xyXG4gIGNvbnN0IGxpbmtQYXR0ZXJuID0gL1xcWyhbXlxcXV0rKVxcXVxcKChodHRwcz86XFwvXFwvW15cXHMpXSspXFwpL2c7XHJcbiAgY29uc3QgdXJsUGF0dGVybiA9IC8oXnxbXFxzKF0pKGh0dHBzPzpcXC9cXC9bXlxcczxdKykvZztcclxuXHJcbiAgbGV0IGh0bWwgPSBlc2NhcGVIdG1sKHZhbHVlKTtcclxuICBodG1sID0gaHRtbC5yZXBsYWNlKGltYWdlUGF0dGVybiwgKF9tYXRjaCwgYWx0LCB1cmwpID0+IHtcclxuICAgIGNvbnN0IHNhZmVBbHQgPSBlc2NhcGVBdHRyaWJ1dGUoYWx0KTtcclxuICAgIGNvbnN0IHNhZmVVcmwgPSBlc2NhcGVBdHRyaWJ1dGUodXJsKTtcclxuICAgIHJldHVybiBgPGZpZ3VyZSBjbGFzcz1cIm1hcmtkb3duLWltYWdlXCI+PGltZyBzcmM9XCIke3NhZmVVcmx9XCIgYWx0PVwiJHtzYWZlQWx0fVwiIGxvYWRpbmc9XCJsYXp5XCIgLz48ZmlnY2FwdGlvbj4ke3NhZmVBbHR9PC9maWdjYXB0aW9uPjwvZmlndXJlPmA7XHJcbiAgfSk7XHJcbiAgaHRtbCA9IGh0bWwucmVwbGFjZShsaW5rUGF0dGVybiwgKF9tYXRjaCwgbGFiZWwsIHVybCkgPT4ge1xyXG4gICAgY29uc3Qgc2FmZUxhYmVsID0gZXNjYXBlSHRtbChsYWJlbCk7XHJcbiAgICBjb25zdCBzYWZlVXJsID0gZXNjYXBlQXR0cmlidXRlKHVybCk7XHJcbiAgICByZXR1cm4gYDxhIGhyZWY9XCIke3NhZmVVcmx9XCIgdGFyZ2V0PVwiX2JsYW5rXCIgcmVsPVwibm9yZWZlcnJlclwiPiR7c2FmZUxhYmVsfTwvYT5gO1xyXG4gIH0pO1xyXG4gIGh0bWwgPSBodG1sLnJlcGxhY2UodXJsUGF0dGVybiwgKF9tYXRjaCwgcHJlZml4LCB1cmwpID0+IHtcclxuICAgIGNvbnN0IHNhZmVVcmwgPSBlc2NhcGVBdHRyaWJ1dGUodXJsKTtcclxuICAgIHJldHVybiBgJHtwcmVmaXh9PGEgaHJlZj1cIiR7c2FmZVVybH1cIiB0YXJnZXQ9XCJfYmxhbmtcIiByZWw9XCJub3JlZmVycmVyXCI+JHtzYWZlVXJsfTwvYT5gO1xyXG4gIH0pO1xyXG4gIGh0bWwgPSBodG1sLnJlcGxhY2UoL1xcKlxcKihbXipdKylcXCpcXCovZywgXCI8c3Ryb25nPiQxPC9zdHJvbmc+XCIpO1xyXG4gIGh0bWwgPSBodG1sLnJlcGxhY2UoLyhefFtcXHM+XSlcXCooW14qXSspXFwqKD89JHxbXFxzPF0pL2csIFwiJDE8ZW0+JDI8L2VtPlwiKTtcclxuICBodG1sID0gaHRtbC5yZXBsYWNlKC9gKFteYF0rKWAvZywgXCI8Y29kZT4kMTwvY29kZT5cIik7XHJcbiAgcmV0dXJuIGh0bWw7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGluZmVyU2VhcmNoTW9kZUZyb21QYWdlQ29udGV4dChcclxuICBwYWdlQ29udGV4dDogRXh0cmFjdDxQYW5lbFJlc3BvbnNlLCB7IG9rOiB0cnVlIH0+W1wicGF5bG9hZFwiXVtcInBhZ2VDb250ZXh0XCJdLFxyXG4pOiBcImhvdGVsc1wiIHwgXCJmbGlnaHRzXCIgfCBcImNhcnNcIiB7XHJcbiAgaWYgKCFwYWdlQ29udGV4dCkgcmV0dXJuIFwiaG90ZWxzXCI7XHJcblxyXG4gIGNvbnN0IHNvdXJjZSA9IFtcclxuICAgIHBhZ2VDb250ZXh0LnRpdGxlLFxyXG4gICAgcGFnZUNvbnRleHQuZGVzY3JpcHRpb24sXHJcbiAgICBwYWdlQ29udGV4dC5zZWxlY3Rpb24sXHJcbiAgICBwYWdlQ29udGV4dC5oZWFkaW5ncy5qb2luKFwiIFwiKSxcclxuICAgIHBhZ2VDb250ZXh0LnRyYXZlbEhpbnRzLmpvaW4oXCIgXCIpLFxyXG4gICAgcGFnZUNvbnRleHQudGV4dEV4Y2VycHQsXHJcbiAgXVxyXG4gICAgLmpvaW4oXCIgXCIpXHJcbiAgICAudG9Mb3dlckNhc2UoKTtcclxuXHJcbiAgaWYgKC9cXGIoZmxpZ2h0fGZsaWdodHN8YWlybGluZXxhaXJwb3J0fGRlcGFydHVyZXxhcnJpdmFsfG5vbnN0b3B8bGF5b3ZlcilcXGIvLnRlc3Qoc291cmNlKSkge1xyXG4gICAgcmV0dXJuIFwiZmxpZ2h0c1wiO1xyXG4gIH1cclxuICBpZiAoL1xcYihjYXJ8Y2Fyc3xyZW50YWx8cmVudCBhIGNhcnx2ZWhpY2xlfHBpY2t1cHxkcm9wb2ZmfGRyb3Atb2ZmKVxcYi8udGVzdChzb3VyY2UpKSB7XHJcbiAgICByZXR1cm4gXCJjYXJzXCI7XHJcbiAgfVxyXG4gIHJldHVybiBcImhvdGVsc1wiO1xyXG59XHJcblxyXG5mdW5jdGlvbiBidWlsZFBhZ2VEcml2ZW5Qcm9tcHQoXHJcbiAgbW9kZTogXCJob3RlbHNcIiB8IFwiZmxpZ2h0c1wiIHwgXCJjYXJzXCIsXHJcbiAgcGFnZUNvbnRleHQ6IEV4dHJhY3Q8UGFuZWxSZXNwb25zZSwgeyBvazogdHJ1ZSB9PltcInBheWxvYWRcIl1bXCJwYWdlQ29udGV4dFwiXSxcclxuKTogc3RyaW5nIHtcclxuICBpZiAoIXBhZ2VDb250ZXh0KSByZXR1cm4gXCJcIjtcclxuXHJcbiAgY29uc3QgaGludHMgPSBwYWdlQ29udGV4dC50cmF2ZWxIaW50cy5qb2luKFwiOyBcIik7XHJcbiAgY29uc3QgY29udGV4dFNuaXBwZXRzID0gW3BhZ2VDb250ZXh0LnNlbGVjdGlvbiwgcGFnZUNvbnRleHQuZGVzY3JpcHRpb24sIHBhZ2VDb250ZXh0LnRleHRFeGNlcnB0XVxyXG4gICAgLm1hcCgodmFsdWUpID0+IHZhbHVlLnRyaW0oKSlcclxuICAgIC5maWx0ZXIoQm9vbGVhbilcclxuICAgIC5zbGljZSgwLCAyKTtcclxuXHJcbiAgaWYgKG1vZGUgPT09IFwiZmxpZ2h0c1wiKSB7XHJcbiAgICByZXR1cm4gYFVzZSB0aGlzIHBhZ2UgY29udGV4dCB0byBzZWFyY2ggZmxpZ2h0cy4gRm9jdXMgb24gZGF0ZXMsIHJvdXRlLCBhbmQgdHJhdmVsZXJzIGZyb206ICR7aGludHMgfHwgcGFnZUNvbnRleHQudGl0bGV9LiAke2NvbnRleHRTbmlwcGV0cy5qb2luKFwiIFwiKX1gLnRyaW0oKTtcclxuICB9XHJcbiAgaWYgKG1vZGUgPT09IFwiY2Fyc1wiKSB7XHJcbiAgICByZXR1cm4gYFVzZSB0aGlzIHBhZ2UgY29udGV4dCB0byBzZWFyY2ggcmVudGFsIGNhcnMuIEZvY3VzIG9uIHBpY2t1cC9kcm9wLW9mZiBsb2NhdGlvbiBhbmQgZGF0ZXMgZnJvbTogJHtoaW50cyB8fCBwYWdlQ29udGV4dC50aXRsZX0uICR7Y29udGV4dFNuaXBwZXRzLmpvaW4oXCIgXCIpfWAudHJpbSgpO1xyXG4gIH1cclxuICByZXR1cm4gYFVzZSB0aGlzIHBhZ2UgY29udGV4dCB0byBzZWFyY2ggaG90ZWxzLiBGb2N1cyBvbiBkZXN0aW5hdGlvbiwgc3RheSBkYXRlcywgYW5kIGd1ZXN0cyBmcm9tOiAke2hpbnRzIHx8IHBhZ2VDb250ZXh0LnRpdGxlfS4gJHtjb250ZXh0U25pcHBldHMuam9pbihcIiBcIil9YC50cmltKCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGljb24obmFtZTogc3RyaW5nKSB7XHJcbiAgY29uc3QgaWNvbnM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XHJcbiAgICBob3RlbHM6IGA8c3ZnIHZpZXdCb3g9XCIwIDAgMjAgMjBcIiBhcmlhLWhpZGRlbj1cInRydWVcIj48cGF0aCBkPVwiTTMgMTVWNWgzYTIgMiAwIDAgMSAyIDJ2MWg1YTQgNCAwIDAgMSA0IDR2M2gtMnYtMkg1djJIM1ptNS01VjdhMSAxIDAgMCAwLTEtMUg1djRoM1ptMiAwaDVhMiAyIDAgMSAwIDAtNGgtNXY0WlwiLz48L3N2Zz5gLFxyXG4gICAgZmxpZ2h0czogYDxzdmcgdmlld0JveD1cIjAgMCAyMCAyMFwiIGFyaWEtaGlkZGVuPVwidHJ1ZVwiPjxwYXRoIGQ9XCJtMTggMTAtNyAyLTMgNS0xLS4zIDEuMi01LjFMNCAxMC41VjkuNGw0LjItMS4xTDcgMy4yIDggM2wzIDUgNyAyWlwiLz48L3N2Zz5gLFxyXG4gICAgY2FyczogYDxzdmcgdmlld0JveD1cIjAgMCAyMCAyMFwiIGFyaWEtaGlkZGVuPVwidHJ1ZVwiPjxwYXRoIGQ9XCJNNSAxNGExLjUgMS41IDAgMSAxIDAgMyAxLjUgMS41IDAgMCAxIDAtM1ptMTAgMGExLjUgMS41IDAgMSAxIDAgMyAxLjUgMS41IDAgMCAxIDAtM1pNNC4xIDExIDUuNyA2LjhBMiAyIDAgMCAxIDcuNiA1LjVoNC44YTIgMiAwIDAgMSAxLjkgMS4zTDE1LjkgMTFIMTdhMSAxIDAgMCAxIDEgMXYyaC0xYTIgMiAwIDAgMC00IDBIN2EyIDIgMCAwIDAtNCAwSDJ2LTJhMSAxIDAgMCAxIDEtMWgxLjFaTTYuMyAxMWg3LjRsLTEuMi0zLjJhMSAxIDAgMCAwLS45LS42SDguNGExIDEgMCAwIDAtLjkuNkw2LjMgMTFaXCIvPjwvc3ZnPmAsXHJcbiAgICBib29raW5nOiBgPHN2ZyB2aWV3Qm94PVwiMCAwIDIwIDIwXCIgYXJpYS1oaWRkZW49XCJ0cnVlXCI+PHBhdGggZD1cIk00IDRoMTJ2MTJINFY0Wm0yIDJ2OGg4VjZINlptMSAyaDZ2MUg3VjhabTAgMmg0djFIN3YtMVpcIi8+PC9zdmc+YCxcclxuICAgIGhvdGVsOiBgPHN2ZyB2aWV3Qm94PVwiMCAwIDIwIDIwXCIgYXJpYS1oaWRkZW49XCJ0cnVlXCI+PHBhdGggZD1cIk0zIDE1VjVoM2EyIDIgMCAwIDEgMiAydjFoNWE0IDQgMCAwIDEgNCA0djNoLTJ2LTJINXYySDNaXCIvPjwvc3ZnPmAsXHJcbiAgICBmbGlnaHQ6IGA8c3ZnIHZpZXdCb3g9XCIwIDAgMjAgMjBcIiBhcmlhLWhpZGRlbj1cInRydWVcIj48cGF0aCBkPVwibTE4IDEwLTcgMi0zIDUtMS0uMyAxLjItNS4xTDQgMTAuNVY5LjRsNC4yLTEuMUw3IDMuMiA4IDNsMyA1IDcgMlpcIi8+PC9zdmc+YCxcclxuICAgIGNhcjogYDxzdmcgdmlld0JveD1cIjAgMCAyMCAyMFwiIGFyaWEtaGlkZGVuPVwidHJ1ZVwiPjxwYXRoIGQ9XCJNNC4xIDExIDUuNyA2LjhBMiAyIDAgMCAxIDcuNiA1LjVoNC44YTIgMiAwIDAgMSAxLjkgMS4zTDE1LjkgMTFIMTdhMSAxIDAgMCAxIDEgMXYyaC0xYTIgMiAwIDAgMC00IDBIN2EyIDIgMCAwIDAtNCAwSDJ2LTJhMSAxIDAgMCAxIDEtMWgxLjFaXCIvPjwvc3ZnPmAsXHJcbiAgICBjb250ZXh0OiBgPHN2ZyB2aWV3Qm94PVwiMCAwIDIwIDIwXCIgYXJpYS1oaWRkZW49XCJ0cnVlXCI+PHBhdGggZD1cIk0xMCAyYTYgNiAwIDAgMSA2IDZjMCA0LjQtNiAxMC02IDEwUzQgMTIuNCA0IDhhNiA2IDAgMCAxIDYtNlptMCAzLjJBMi44IDIuOCAwIDEgMCAxMCAxMC44YTIuOCAyLjggMCAwIDAgMC01LjZaXCIvPjwvc3ZnPmAsXHJcbiAgICBzcGFyazogYDxzdmcgdmlld0JveD1cIjAgMCAyMCAyMFwiIGFyaWEtaGlkZGVuPVwidHJ1ZVwiPjxwYXRoIGQ9XCJtMTAgMiAxLjcgNC44TDE2LjUgOGwtNC44IDEuMkwxMCAxNGwtMS43LTQuOEwzLjUgOGw0LjgtMS4yTDEwIDJabTUuNSAxMCAxIDIuNyAyLjUuOC0yLjUuNy0xIDIuOC0xLTIuOC0yLjUtLjcgMi41LS44IDEtMi43WlwiLz48L3N2Zz5gLFxyXG4gICAgdHJhY2U6IGA8c3ZnIHZpZXdCb3g9XCIwIDAgMjAgMjBcIiBhcmlhLWhpZGRlbj1cInRydWVcIj48cGF0aCBkPVwiTTMgNGgxNHYySDNWNFptMCA1aDl2MkgzVjlabTAgNWgxNHYySDN2LTJabTExLTVoM3YyaC0zVjlaXCIvPjwvc3ZnPmAsXHJcbiAgICBzZW5kOiBgPHN2ZyB2aWV3Qm94PVwiMCAwIDIwIDIwXCIgYXJpYS1oaWRkZW49XCJ0cnVlXCI+PHBhdGggZD1cIk0zIDE3IDE4IDEwIDMgM2wxLjYgNS40TDEyIDEwIDQuNiAxMS42IDMgMTdaXCIvPjwvc3ZnPmAsXHJcbiAgICBzYXZlOiBgPHN2ZyB2aWV3Qm94PVwiMCAwIDIwIDIwXCIgYXJpYS1oaWRkZW49XCJ0cnVlXCI+PHBhdGggZD1cIk00IDNoOWwzIDN2MTFINFYzWm0yIDJ2M2g3VjVINlptMCA3djNoOHYtM0g2WlwiLz48L3N2Zz5gLFxyXG4gICAgb3BlbjogYDxzdmcgdmlld0JveD1cIjAgMCAyMCAyMFwiIGFyaWEtaGlkZGVuPVwidHJ1ZVwiPjxwYXRoIGQ9XCJNMTEgNGg1djVoLTJWNy40bC01LjMgNS4zLTEuNC0xLjRMMTIuNiA2SDExVjRaTTUgNmg0djJIN3Y2aDZ2LTJoMnY0SDVWNlpcIi8+PC9zdmc+YCxcclxuICAgIHVzZTogYDxzdmcgdmlld0JveD1cIjAgMCAyMCAyMFwiIGFyaWEtaGlkZGVuPVwidHJ1ZVwiPjxwYXRoIGQ9XCJtOC40IDEzLjYtMy0zIDEuNC0xLjQgMS42IDEuNiA0LjgtNC44IDEuNCAxLjQtNi4yIDYuMlpcIi8+PC9zdmc+YCxcclxuICAgIGVtcHR5OiBgPHN2ZyB2aWV3Qm94PVwiMCAwIDIwIDIwXCIgYXJpYS1oaWRkZW49XCJ0cnVlXCI+PHBhdGggZD1cIk00IDVoMTJ2MTBINFY1Wm0yIDJ2Nmg4VjdINlptMSAxaDZ2MUg3VjhabTAgMmg0djFIN3YtMVpcIi8+PC9zdmc+YCxcclxuICB9O1xyXG5cclxuICByZXR1cm4gYDxzcGFuIGNsYXNzPVwiaWNvbiBpY29uLSR7ZXNjYXBlQXR0cmlidXRlKG5hbWUpfVwiPiR7aWNvbnNbbmFtZV0gPz8gaWNvbnMuc3Bhcmt9PC9zcGFuPmA7XHJcbn1cclxuIl0sCiAgIm1h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
