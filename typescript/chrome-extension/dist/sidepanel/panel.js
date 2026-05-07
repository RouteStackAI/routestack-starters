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
  settings: null
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

        ${item.description ? `<div class="description markdown-body">${renderHtmlDescription(item.description)}</div>` : ""}
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
  if (section.kind === "car") return `Show me more details for this car option: ${subject}.`;
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
    const prompt = state.promptDraft.trim();
    if (!prompt) return;
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
function renderHtmlDescription(value) {
  const template = document.createElement("template");
  template.innerHTML = value;
  const allowedTags = /* @__PURE__ */ new Set([
    "P",
    "BR",
    "STRONG",
    "B",
    "EM",
    "I",
    "UL",
    "OL",
    "LI"
  ]);
  const sanitizeNode = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return escapeHtml(node.textContent ?? "");
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }
    const element = node;
    const tag = element.tagName.toUpperCase();
    const children = Array.from(element.childNodes).map((child) => sanitizeNode(child)).join("");
    if (!allowedTags.has(tag)) {
      return children;
    }
    const tagName = tag.toLowerCase();
    return `<${tagName}>${children}</${tagName}>`;
  };
  return Array.from(template.content.childNodes).map((node) => sanitizeNode(node)).join("");
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc3JjL2xpYi9idWlsZC1jb25maWcuZ2VuZXJhdGVkLnRzIiwgIi4uLy4uL3NyYy9saWIvY29uZmlnLnRzIiwgIi4uLy4uL3NyYy9zaWRlcGFuZWwvcGFuZWwudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImV4cG9ydCBjb25zdCBidWlsZERlZmF1bHRzID0ge1xuICByb3V0ZXN0YWNrOiB7IGFwaUtleTogXCJyc3Rfa0FYZmFDZEdfYVk1aG1iTTUyR090cURJU3lFM29RcHVcIiwgYXBpU2VjcmV0OiBcImU2Yzk4ZDA3YjIxNzI1YmY3MzJlNjliOTg2OTJlZDViY2M5OGQ1MjkzN2FhNzg5Y2NiY2UzNDdkMTAxOThmNTlcIiwgbWNwVXJsOiBcImh0dHBzOi8vbWNwLnJvdXRlc3RhY2suYWkvc3NlXCIgfSxcbiAgbGxtOiB7XG4gICAgcHJvdmlkZXI6IFwibWlzdHJhbFwiLFxuICAgIG9wZW5haTogeyBhcGlLZXk6IFwieW91cl9vcGVuYWlfa2V5X2hlcmVcIiwgbW9kZWw6IFwiZ3B0LTRvXCIgfSxcbiAgICBhbnRocm9waWM6IHsgYXBpS2V5OiBcIlwiLCBtb2RlbDogXCJjbGF1ZGUtc29ubmV0LTQtNS1sYXRlc3RcIiB9LFxuICAgIG1pc3RyYWw6IHsgYXBpS2V5OiBcIlNDWWtBT0x6cHFGNkg5U1Z2SmVIUjQ1dUFRa1NKV3BUXCIsIG1vZGVsOiBcIm1pc3RyYWwtbGFyZ2UtbGF0ZXN0XCIsIGJhc2VVcmw6IFwiaHR0cHM6Ly9hcGkubWlzdHJhbC5haS92MVwiIH0sXG4gIH0sXG59IGFzIGNvbnN0O1xuIiwgImltcG9ydCB7IGJ1aWxkRGVmYXVsdHMgfSBmcm9tIFwiLi9idWlsZC1jb25maWcuZ2VuZXJhdGVkLmpzXCI7XG5cbmV4cG9ydCB0eXBlIExsbVByb3ZpZGVyID0gXCJvcGVuYWlcIiB8IFwiYW50aHJvcGljXCIgfCBcIm1pc3RyYWxcIjtcblxuZXhwb3J0IGludGVyZmFjZSBFeHRlbnNpb25TZXR0aW5ncyB7XG4gIHJvdXRlc3RhY2s6IHtcbiAgICBhcGlLZXk6IHN0cmluZztcbiAgICBhcGlTZWNyZXQ6IHN0cmluZztcbiAgICBtY3BVcmw6IHN0cmluZztcbiAgfTtcbiAgbGxtOiB7XG4gICAgcHJvdmlkZXI6IExsbVByb3ZpZGVyO1xuICAgIG9wZW5haToge1xuICAgICAgYXBpS2V5OiBzdHJpbmc7XG4gICAgICBtb2RlbDogc3RyaW5nO1xuICAgIH07XG4gICAgYW50aHJvcGljOiB7XG4gICAgICBhcGlLZXk6IHN0cmluZztcbiAgICAgIG1vZGVsOiBzdHJpbmc7XG4gICAgfTtcbiAgICBtaXN0cmFsOiB7XG4gICAgICBhcGlLZXk6IHN0cmluZztcbiAgICAgIG1vZGVsOiBzdHJpbmc7XG4gICAgICBiYXNlVXJsOiBzdHJpbmc7XG4gICAgfTtcbiAgfTtcbn1cblxuY29uc3QgZGVmYXVsdHM6IEV4dGVuc2lvblNldHRpbmdzID0ge1xuICByb3V0ZXN0YWNrOiB7XG4gICAgYXBpS2V5OiBidWlsZERlZmF1bHRzLnJvdXRlc3RhY2suYXBpS2V5LFxuICAgIGFwaVNlY3JldDogYnVpbGREZWZhdWx0cy5yb3V0ZXN0YWNrLmFwaVNlY3JldCxcbiAgICBtY3BVcmw6IGJ1aWxkRGVmYXVsdHMucm91dGVzdGFjay5tY3BVcmwsXG4gIH0sXG4gIGxsbToge1xuICAgIHByb3ZpZGVyOiBub3JtYWxpemVQcm92aWRlcihidWlsZERlZmF1bHRzLmxsbS5wcm92aWRlciksXG4gICAgb3BlbmFpOiB7XG4gICAgICBhcGlLZXk6IGJ1aWxkRGVmYXVsdHMubGxtLm9wZW5haS5hcGlLZXksXG4gICAgICBtb2RlbDogYnVpbGREZWZhdWx0cy5sbG0ub3BlbmFpLm1vZGVsLFxuICAgIH0sXG4gICAgYW50aHJvcGljOiB7XG4gICAgICBhcGlLZXk6IGJ1aWxkRGVmYXVsdHMubGxtLmFudGhyb3BpYy5hcGlLZXksXG4gICAgICBtb2RlbDogYnVpbGREZWZhdWx0cy5sbG0uYW50aHJvcGljLm1vZGVsLFxuICAgIH0sXG4gICAgbWlzdHJhbDoge1xuICAgICAgYXBpS2V5OiBidWlsZERlZmF1bHRzLmxsbS5taXN0cmFsLmFwaUtleSxcbiAgICAgIG1vZGVsOiBidWlsZERlZmF1bHRzLmxsbS5taXN0cmFsLm1vZGVsLFxuICAgICAgYmFzZVVybDogYnVpbGREZWZhdWx0cy5sbG0ubWlzdHJhbC5iYXNlVXJsLFxuICAgIH0sXG4gIH0sXG59O1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0U2V0dGluZ3MoKTogUHJvbWlzZTxFeHRlbnNpb25TZXR0aW5ncz4ge1xuICBjb25zdCBzdG9yZWQgPSBhd2FpdCBjaHJvbWUuc3RvcmFnZS5sb2NhbC5nZXQoXCJyb3V0ZXN0YWNrX3NldHRpbmdzXCIpO1xuICByZXR1cm4gbWVyZ2VTZXR0aW5ncyhkZWZhdWx0cywgc3RvcmVkLnJvdXRlc3RhY2tfc2V0dGluZ3MgYXMgUGFydGlhbDxFeHRlbnNpb25TZXR0aW5ncz4gfCB1bmRlZmluZWQpO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc2F2ZVNldHRpbmdzKHNldHRpbmdzOiBQYXJ0aWFsPEV4dGVuc2lvblNldHRpbmdzPik6IFByb21pc2U8RXh0ZW5zaW9uU2V0dGluZ3M+IHtcbiAgY29uc3QgbWVyZ2VkID0gbWVyZ2VTZXR0aW5ncyhhd2FpdCBnZXRTZXR0aW5ncygpLCBzZXR0aW5ncyk7XG4gIGF3YWl0IGNocm9tZS5zdG9yYWdlLmxvY2FsLnNldCh7IHJvdXRlc3RhY2tfc2V0dGluZ3M6IG1lcmdlZCB9KTtcbiAgcmV0dXJuIG1lcmdlZDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFByb3ZpZGVyQXBpS2V5KHNldHRpbmdzOiBFeHRlbnNpb25TZXR0aW5ncyk6IHN0cmluZyB7XG4gIGlmIChzZXR0aW5ncy5sbG0ucHJvdmlkZXIgPT09IFwiYW50aHJvcGljXCIpIHJldHVybiBzZXR0aW5ncy5sbG0uYW50aHJvcGljLmFwaUtleTtcbiAgaWYgKHNldHRpbmdzLmxsbS5wcm92aWRlciA9PT0gXCJtaXN0cmFsXCIpIHJldHVybiBzZXR0aW5ncy5sbG0ubWlzdHJhbC5hcGlLZXk7XG4gIHJldHVybiBzZXR0aW5ncy5sbG0ub3BlbmFpLmFwaUtleTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHZhbGlkYXRlU2V0dGluZ3Moc2V0dGluZ3M6IEV4dGVuc2lvblNldHRpbmdzKTogc3RyaW5nW10ge1xuICBjb25zdCBpc3N1ZXM6IHN0cmluZ1tdID0gW107XG5cbiAgaWYgKCFzZXR0aW5ncy5yb3V0ZXN0YWNrLmFwaUtleSkgaXNzdWVzLnB1c2goXCJSb3V0ZVN0YWNrIEFQSSBrZXkgaXMgbWlzc2luZy5cIik7XG4gIGlmICghc2V0dGluZ3Mucm91dGVzdGFjay5tY3BVcmwpIGlzc3Vlcy5wdXNoKFwiUm91dGVTdGFjayBNQ1AgVVJMIGlzIG1pc3NpbmcuXCIpO1xuICBpZiAoIWdldFByb3ZpZGVyQXBpS2V5KHNldHRpbmdzKSkge1xuICAgIGlzc3Vlcy5wdXNoKGBUaGUgJHtzZXR0aW5ncy5sbG0ucHJvdmlkZXJ9IEFQSSBrZXkgaXMgbWlzc2luZy5gKTtcbiAgfVxuXG4gIHJldHVybiBpc3N1ZXM7XG59XG5cbmZ1bmN0aW9uIG1lcmdlU2V0dGluZ3MoXG4gIGJhc2U6IEV4dGVuc2lvblNldHRpbmdzLFxuICBpbmNvbWluZz86IFBhcnRpYWw8RXh0ZW5zaW9uU2V0dGluZ3M+LFxuKTogRXh0ZW5zaW9uU2V0dGluZ3Mge1xuICByZXR1cm4ge1xuICAgIHJvdXRlc3RhY2s6IHtcbiAgICAgIGFwaUtleTogaW5jb21pbmc/LnJvdXRlc3RhY2s/LmFwaUtleSA/PyBiYXNlLnJvdXRlc3RhY2suYXBpS2V5LFxuICAgICAgYXBpU2VjcmV0OiBpbmNvbWluZz8ucm91dGVzdGFjaz8uYXBpU2VjcmV0ID8/IGJhc2Uucm91dGVzdGFjay5hcGlTZWNyZXQsXG4gICAgICBtY3BVcmw6IGluY29taW5nPy5yb3V0ZXN0YWNrPy5tY3BVcmwgPz8gYmFzZS5yb3V0ZXN0YWNrLm1jcFVybCxcbiAgICB9LFxuICAgIGxsbToge1xuICAgICAgcHJvdmlkZXI6IG5vcm1hbGl6ZVByb3ZpZGVyKGluY29taW5nPy5sbG0/LnByb3ZpZGVyID8/IGJhc2UubGxtLnByb3ZpZGVyKSxcbiAgICAgIG9wZW5haToge1xuICAgICAgICBhcGlLZXk6IGluY29taW5nPy5sbG0/Lm9wZW5haT8uYXBpS2V5ID8/IGJhc2UubGxtLm9wZW5haS5hcGlLZXksXG4gICAgICAgIG1vZGVsOiBpbmNvbWluZz8ubGxtPy5vcGVuYWk/Lm1vZGVsID8/IGJhc2UubGxtLm9wZW5haS5tb2RlbCxcbiAgICAgIH0sXG4gICAgICBhbnRocm9waWM6IHtcbiAgICAgICAgYXBpS2V5OiBpbmNvbWluZz8ubGxtPy5hbnRocm9waWM/LmFwaUtleSA/PyBiYXNlLmxsbS5hbnRocm9waWMuYXBpS2V5LFxuICAgICAgICBtb2RlbDogaW5jb21pbmc/LmxsbT8uYW50aHJvcGljPy5tb2RlbCA/PyBiYXNlLmxsbS5hbnRocm9waWMubW9kZWwsXG4gICAgICB9LFxuICAgICAgbWlzdHJhbDoge1xuICAgICAgICBhcGlLZXk6IGluY29taW5nPy5sbG0/Lm1pc3RyYWw/LmFwaUtleSA/PyBiYXNlLmxsbS5taXN0cmFsLmFwaUtleSxcbiAgICAgICAgbW9kZWw6IGluY29taW5nPy5sbG0/Lm1pc3RyYWw/Lm1vZGVsID8/IGJhc2UubGxtLm1pc3RyYWwubW9kZWwsXG4gICAgICAgIGJhc2VVcmw6IGluY29taW5nPy5sbG0/Lm1pc3RyYWw/LmJhc2VVcmwgPz8gYmFzZS5sbG0ubWlzdHJhbC5iYXNlVXJsLFxuICAgICAgfSxcbiAgICB9LFxuICB9O1xufVxuXG5mdW5jdGlvbiBub3JtYWxpemVQcm92aWRlcih2YWx1ZTogc3RyaW5nKTogTGxtUHJvdmlkZXIge1xuICBpZiAodmFsdWUgPT09IFwiYW50aHJvcGljXCIgfHwgdmFsdWUgPT09IFwibWlzdHJhbFwiKSByZXR1cm4gdmFsdWU7XG4gIHJldHVybiBcIm9wZW5haVwiO1xufVxuXHJcbiIsICJpbXBvcnQgeyBzYXZlU2V0dGluZ3MsIHR5cGUgRXh0ZW5zaW9uU2V0dGluZ3MgfSBmcm9tIFwiLi4vbGliL2NvbmZpZy5qc1wiO1xuaW1wb3J0IHR5cGUgeyBQYW5lbFJlcXVlc3QsIFBhbmVsUmVzcG9uc2UsIFJlc3VsdEl0ZW0sIFJlc3VsdFNlY3Rpb24gfSBmcm9tIFwiLi4vbGliL3R5cGVzLmpzXCI7XG5cbmNvbnN0IGFwcFJvb3QgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yPEhUTUxEaXZFbGVtZW50PihcIiNhcHBcIik7XG5cbmlmICghYXBwUm9vdCkge1xuICB0aHJvdyBuZXcgRXJyb3IoXCJSb3V0ZVN0YWNrIHNpZGUgcGFuZWwgcm9vdCB3YXMgbm90IGZvdW5kLlwiKTtcbn1cblxuY29uc3QgYXBwID0gYXBwUm9vdDtcblxuY29uc3Qgc3RhdGUgPSB7XG4gIHRhYklkOiAwLFxuICBsb2FkaW5nOiBmYWxzZSxcbiAgc2VhcmNoTW9kZTogXCJob3RlbHNcIiBhcyBcImhvdGVsc1wiIHwgXCJmbGlnaHRzXCIgfCBcImNhcnNcIixcbiAgc2V0dGluZ3NPcGVuOiBmYWxzZSxcbiAgZGlhZ25vc3RpY3NPcGVuOiBmYWxzZSxcbiAgYXNzaXN0YW50TWVzc2FnZTogXCJcIixcbiAgcGFnZVN1bW1hcnk6IFwiXCIsXG4gIHByb21wdERyYWZ0OiBcIlwiLFxuICByZXN1bHRTZWN0aW9uczogW10gYXMgUmVzdWx0U2VjdGlvbltdLFxuICB0b29sQ2FsbHM6IFtdIGFzIEFycmF5PHsgbmFtZTogc3RyaW5nOyBzdW1tYXJ5OiBzdHJpbmcgfT4sXG4gIHNldHRpbmdzSXNzdWVzOiBbXSBhcyBzdHJpbmdbXSxcbiAgc2V0dGluZ3M6IG51bGwgYXMgRXh0ZW5zaW9uU2V0dGluZ3MgfCBudWxsLFxufTtcblxudm9pZCBib290c3RyYXAoKTtcblxuYXN5bmMgZnVuY3Rpb24gYm9vdHN0cmFwKCkge1xuICBjb25zdCBbdGFiXSA9IGF3YWl0IGNocm9tZS50YWJzLnF1ZXJ5KHsgYWN0aXZlOiB0cnVlLCBjdXJyZW50V2luZG93OiB0cnVlIH0pO1xuICBzdGF0ZS50YWJJZCA9IHRhYj8uaWQgPz8gMDtcblxuICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHNlbmRSZXF1ZXN0KHtcbiAgICB0eXBlOiBcIlJPVVRFU1RBQ0tfQk9PVFNUUkFQXCIsXG4gICAgdGFiSWQ6IHN0YXRlLnRhYklkLFxuICB9KTtcblxuICBpZiAocmVzcG9uc2Uub2spIHtcbiAgICBhcHBseVBheWxvYWQocmVzcG9uc2UpO1xuICB9IGVsc2Uge1xuICAgIHN0YXRlLmFzc2lzdGFudE1lc3NhZ2UgPSByZXNwb25zZS5lcnJvcjtcbiAgICBzdGF0ZS5zZXR0aW5ncyA9IHJlc3BvbnNlLnNldHRpbmdzID8/IG51bGw7XG4gIH1cblxuICByZW5kZXIoKTtcbn1cblxuZnVuY3Rpb24gcmVuZGVyKCkge1xuICBhcHAuaW5uZXJIVE1MID0gYFxuICAgIDxkaXYgY2xhc3M9XCJzaGVsbFwiPlxuICAgICAgPGRpdiBjbGFzcz1cImNvbnRlbnQtYXJlYVwiPlxuICAgICAgICA8c2VjdGlvbiBjbGFzcz1cImhlcm9cIj5cbiAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgPHAgY2xhc3M9XCJleWVicm93XCI+Um91dGVTdGFjay5haTwvcD5cbiAgICAgICAgICAgIDxoMT5UcmF2ZWwgcGxhbm5pbmcgdGhhdCBzdGF5cyBpbiB0aGUgZmxvdyBvZiB0aGUgcGFnZS48L2gxPlxuICAgICAgICAgICAgPHAgY2xhc3M9XCJsZWRlXCI+U2VhcmNoIGhvdGVscywgZmxpZ2h0cywgYW5kIHJlbnRhbCBjYXJzIHdpdGhvdXQgbGVhdmluZyB3aGF0IHlvdSBhcmUgYWxyZWFkeSByZWFkaW5nLjwvcD5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiaGVyby1hY3Rpb25zXCI+XG4gICAgICAgICAgICA8YnV0dG9uIGNsYXNzPVwiZ2hvc3RcIiBpZD1cInNldHRpbmdzLXRvZ2dsZVwiPiR7c3RhdGUuc2V0dGluZ3NPcGVuID8gXCJDbG9zZSBzZXR0aW5nc1wiIDogXCJTZXR0aW5nc1wifTwvYnV0dG9uPlxuICAgICAgICAgICAgPGJ1dHRvbiBjbGFzcz1cImdob3N0XCIgaWQ9XCJyZXNldC1idG5cIiAke3N0YXRlLmxvYWRpbmcgPyBcImRpc2FibGVkXCIgOiBcIlwifT5SZXNldDwvYnV0dG9uPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L3NlY3Rpb24+XG5cbiAgICAgICAgJHtyZW5kZXJTZXR0aW5ncygpfVxuXG4gICAgICAgIDxzZWN0aW9uIGNsYXNzPVwiZmVlZC1jYXJkXCI+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImZlZWQtaGVhZFwiPlxuICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgPHAgY2xhc3M9XCJleWVicm93XCI+QXNzaXN0YW50PC9wPlxuICAgICAgICAgICAgICA8aDI+WW91ciB0cmF2ZWwgZGVzazwvaDI+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICR7cmVuZGVyRGlhZ25vc3RpY3NUb2dnbGUoKX1cbiAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICR7c3RhdGUucGFnZVN1bW1hcnkgPyBgPGRpdiBjbGFzcz1cImNvbnRleHQtY2hpcFwiPiR7aWNvbihcImNvbnRleHRcIil9JHtlc2NhcGVIdG1sKHN0YXRlLnBhZ2VTdW1tYXJ5KX08L2Rpdj5gIDogXCJcIn1cblxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJhc3Npc3RhbnQtYnViYmxlICR7c3RhdGUubG9hZGluZyA/IFwiYXNzaXN0YW50LWJ1YmJsZS1saXZlXCIgOiBcIlwifVwiPlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImJ1YmJsZS1pY29uXCI+JHtpY29uKFwic3BhcmtcIil9PC9kaXY+XG4gICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICA8cCBjbGFzcz1cImJ1YmJsZS10aXRsZVwiPiR7c3RhdGUubG9hZGluZyA/IFwiV29ya2luZyBvbiBpdFwiIDogXCJMYXRlc3QgdXBkYXRlXCJ9PC9wPlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYnViYmxlLWNvcHkgbWFya2Rvd24tYm9keVwiPiR7cmVuZGVyUmljaFRleHQoc3RhdGUuYXNzaXN0YW50TWVzc2FnZSB8fCBcIlN0YXJ0IHdpdGggYSB0cmF2ZWwgcmVxdWVzdCBhbmQgSSdsbCB0dXJuIGl0IGludG8gYm9va2FibGUgb3B0aW9ucy5cIil9PC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICR7cmVuZGVyRGlhZ25vc3RpY3MoKX1cbiAgICAgICAgICAke3JlbmRlclVuaWZpZWRSZXN1bHRzKCl9XG4gICAgICAgIDwvc2VjdGlvbj5cbiAgICAgIDwvZGl2PlxuXG4gICAgICA8c2VjdGlvbiBjbGFzcz1cImNvbXBvc2VyLWRvY2tcIj5cbiAgICAgICAgPGRpdiBjbGFzcz1cImNvbXBvc2VyLWNhcmRcIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwibW9kZS1yb3dcIj5cbiAgICAgICAgICAgICR7W1wiaG90ZWxzXCIsIFwiZmxpZ2h0c1wiLCBcImNhcnNcIl1cbiAgICAgICAgICAgICAgLm1hcChcbiAgICAgICAgICAgICAgICAobW9kZSkgPT4gYFxuICAgICAgICAgICAgICAgICAgPGJ1dHRvbiBjbGFzcz1cInBpbGwgJHtzdGF0ZS5zZWFyY2hNb2RlID09PSBtb2RlID8gXCJwaWxsLWFjdGl2ZVwiIDogXCJcIn1cIiBkYXRhLW1vZGU9XCIke21vZGV9XCI+XG4gICAgICAgICAgICAgICAgICAgICR7aWNvbihtb2RlKX0ke2NhcGl0YWxpemUobW9kZSl9XG4gICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICBgLFxuICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgIC5qb2luKFwiXCIpfVxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDx0ZXh0YXJlYSBpZD1cInByb21wdFwiIHJvd3M9XCIzXCIgcGxhY2Vob2xkZXI9XCJGaW5kIHJlZnVuZGFibGUgaG90ZWxzIGluIEF1c3RpbiBmb3IgSnVuZSAxNC0xNiBmb3IgMiBhZHVsdHMsIG9yIGFzayBmb3IgdGhlIGJlc3Qgbm9uc3RvcCBmbGlnaHQgZnJvbSBEZW52ZXIuXCI+JHtlc2NhcGVIdG1sKHN0YXRlLnByb21wdERyYWZ0KX08L3RleHRhcmVhPlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJjb21wb3Nlci1mb290ZXJcIj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjb21wb3Nlci1oaW50XCI+JHtzdGF0ZS5sb2FkaW5nID8gXCJTZWFyY2hpbmcgbGl2ZSBpbnZlbnRvcnkuLi5cIiA6IFwiQXNrIG5hdHVyYWxseS4gWW91IGNhbiBhbHNvIHNheSBib29rIHRoZSBiZXN0IG9wdGlvbi5cIn08L2Rpdj5cbiAgICAgICAgICAgIDxidXR0b24gY2xhc3M9XCJwcmltYXJ5XCIgaWQ9XCJzZWFyY2gtYnRuXCIgJHtzdGF0ZS5sb2FkaW5nID8gXCJkaXNhYmxlZFwiIDogXCJcIn0+XG4gICAgICAgICAgICAgICR7aWNvbihcInNlbmRcIil9XG4gICAgICAgICAgICAgICR7c3RhdGUubG9hZGluZyA/IFwiU2VhcmNoaW5nLi4uXCIgOiBcIlNlYXJjaCBsaXZlIGludmVudG9yeVwifVxuICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgJHtzdGF0ZS5zZXR0aW5nc0lzc3Vlcy5sZW5ndGggPyBgPGRpdiBjbGFzcz1cIndhcm5pbmdcIj4ke3N0YXRlLnNldHRpbmdzSXNzdWVzLmpvaW4oXCIgXCIpfTwvZGl2PmAgOiBcIlwifVxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvc2VjdGlvbj5cbiAgICA8L2Rpdj5cbiAgYDtcblxuICB3aXJlRXZlbnRzKCk7XG59XG5cbmZ1bmN0aW9uIHJlbmRlclNldHRpbmdzKCkge1xuICBpZiAoIXN0YXRlLnNldHRpbmdzT3BlbiB8fCAhc3RhdGUuc2V0dGluZ3MpIHJldHVybiBcIlwiO1xuXG4gIHJldHVybiBgXG4gICAgPHNlY3Rpb24gY2xhc3M9XCJzZXR0aW5ncy1jYXJkXCI+XG4gICAgICA8ZGl2IGNsYXNzPVwic2VjdGlvbi1oZWFkXCI+XG4gICAgICAgIDxoMj5TZXR0aW5nczwvaDI+XG4gICAgICAgIDxzcGFuIGNsYXNzPVwiYmFkZ2VcIj5TdG9yZWQgbG9jYWxseTwvc3Bhbj5cbiAgICAgIDwvZGl2PlxuICAgICAgPGRpdiBjbGFzcz1cImZpZWxkLWdyaWRcIj5cbiAgICAgICAgPGxhYmVsPlxuICAgICAgICAgIDxzcGFuPlJvdXRlU3RhY2sgQVBJIGtleTwvc3Bhbj5cbiAgICAgICAgICA8aW5wdXQgaWQ9XCJyb3V0ZXN0YWNrLWFwaS1rZXlcIiB2YWx1ZT1cIiR7ZXNjYXBlQXR0cmlidXRlKHN0YXRlLnNldHRpbmdzLnJvdXRlc3RhY2suYXBpS2V5KX1cIiAvPlxuICAgICAgICA8L2xhYmVsPlxuICAgICAgICA8bGFiZWw+XG4gICAgICAgICAgPHNwYW4+Um91dGVTdGFjayBBUEkgc2VjcmV0PC9zcGFuPlxuICAgICAgICAgIDxpbnB1dCBpZD1cInJvdXRlc3RhY2stYXBpLXNlY3JldFwiIHZhbHVlPVwiJHtlc2NhcGVBdHRyaWJ1dGUoc3RhdGUuc2V0dGluZ3Mucm91dGVzdGFjay5hcGlTZWNyZXQpfVwiIC8+XG4gICAgICAgIDwvbGFiZWw+XG4gICAgICAgIDxsYWJlbD5cbiAgICAgICAgICA8c3Bhbj5NQ1AgVVJMPC9zcGFuPlxuICAgICAgICAgIDxpbnB1dCBpZD1cInJvdXRlc3RhY2stbWNwLXVybFwiIHZhbHVlPVwiJHtlc2NhcGVBdHRyaWJ1dGUoc3RhdGUuc2V0dGluZ3Mucm91dGVzdGFjay5tY3BVcmwpfVwiIC8+XG4gICAgICAgIDwvbGFiZWw+XG4gICAgICAgIDxsYWJlbD5cbiAgICAgICAgICA8c3Bhbj5MTE0gcHJvdmlkZXI8L3NwYW4+XG4gICAgICAgICAgPHNlbGVjdCBpZD1cImxsbS1wcm92aWRlclwiPlxuICAgICAgICAgICAgJHtbXCJvcGVuYWlcIiwgXCJhbnRocm9waWNcIiwgXCJtaXN0cmFsXCJdXG4gICAgICAgICAgICAgIC5tYXAoXG4gICAgICAgICAgICAgICAgKHByb3ZpZGVyKSA9PlxuICAgICAgICAgICAgICAgICAgYDxvcHRpb24gdmFsdWU9XCIke3Byb3ZpZGVyfVwiICR7c3RhdGUuc2V0dGluZ3M/LmxsbS5wcm92aWRlciA9PT0gcHJvdmlkZXIgPyBcInNlbGVjdGVkXCIgOiBcIlwifT4ke3Byb3ZpZGVyfTwvb3B0aW9uPmAsXG4gICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgLmpvaW4oXCJcIil9XG4gICAgICAgICAgPC9zZWxlY3Q+XG4gICAgICAgIDwvbGFiZWw+XG4gICAgICAgIDxsYWJlbD5cbiAgICAgICAgICA8c3Bhbj5PcGVuQUkga2V5PC9zcGFuPlxuICAgICAgICAgIDxpbnB1dCBpZD1cIm9wZW5haS1hcGkta2V5XCIgdmFsdWU9XCIke2VzY2FwZUF0dHJpYnV0ZShzdGF0ZS5zZXR0aW5ncy5sbG0ub3BlbmFpLmFwaUtleSl9XCIgLz5cbiAgICAgICAgPC9sYWJlbD5cbiAgICAgICAgPGxhYmVsPlxuICAgICAgICAgIDxzcGFuPk9wZW5BSSBtb2RlbDwvc3Bhbj5cbiAgICAgICAgICA8aW5wdXQgaWQ9XCJvcGVuYWktbW9kZWxcIiB2YWx1ZT1cIiR7ZXNjYXBlQXR0cmlidXRlKHN0YXRlLnNldHRpbmdzLmxsbS5vcGVuYWkubW9kZWwpfVwiIC8+XG4gICAgICAgIDwvbGFiZWw+XG4gICAgICAgIDxsYWJlbD5cbiAgICAgICAgICA8c3Bhbj5BbnRocm9waWMga2V5PC9zcGFuPlxuICAgICAgICAgIDxpbnB1dCBpZD1cImFudGhyb3BpYy1hcGkta2V5XCIgdmFsdWU9XCIke2VzY2FwZUF0dHJpYnV0ZShzdGF0ZS5zZXR0aW5ncy5sbG0uYW50aHJvcGljLmFwaUtleSl9XCIgLz5cbiAgICAgICAgPC9sYWJlbD5cbiAgICAgICAgPGxhYmVsPlxuICAgICAgICAgIDxzcGFuPkFudGhyb3BpYyBtb2RlbDwvc3Bhbj5cbiAgICAgICAgICA8aW5wdXQgaWQ9XCJhbnRocm9waWMtbW9kZWxcIiB2YWx1ZT1cIiR7ZXNjYXBlQXR0cmlidXRlKHN0YXRlLnNldHRpbmdzLmxsbS5hbnRocm9waWMubW9kZWwpfVwiIC8+XG4gICAgICAgIDwvbGFiZWw+XG4gICAgICAgIDxsYWJlbD5cbiAgICAgICAgICA8c3Bhbj5NaXN0cmFsIGtleTwvc3Bhbj5cbiAgICAgICAgICA8aW5wdXQgaWQ9XCJtaXN0cmFsLWFwaS1rZXlcIiB2YWx1ZT1cIiR7ZXNjYXBlQXR0cmlidXRlKHN0YXRlLnNldHRpbmdzLmxsbS5taXN0cmFsLmFwaUtleSl9XCIgLz5cbiAgICAgICAgPC9sYWJlbD5cbiAgICAgICAgPGxhYmVsPlxuICAgICAgICAgIDxzcGFuPk1pc3RyYWwgbW9kZWw8L3NwYW4+XG4gICAgICAgICAgPGlucHV0IGlkPVwibWlzdHJhbC1tb2RlbFwiIHZhbHVlPVwiJHtlc2NhcGVBdHRyaWJ1dGUoc3RhdGUuc2V0dGluZ3MubGxtLm1pc3RyYWwubW9kZWwpfVwiIC8+XG4gICAgICAgIDwvbGFiZWw+XG4gICAgICAgIDxsYWJlbD5cbiAgICAgICAgICA8c3Bhbj5NaXN0cmFsIGJhc2UgVVJMPC9zcGFuPlxuICAgICAgICAgIDxpbnB1dCBpZD1cIm1pc3RyYWwtYmFzZS11cmxcIiB2YWx1ZT1cIiR7ZXNjYXBlQXR0cmlidXRlKHN0YXRlLnNldHRpbmdzLmxsbS5taXN0cmFsLmJhc2VVcmwpfVwiIC8+XG4gICAgICAgIDwvbGFiZWw+XG4gICAgICA8L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJhY3Rpb24tcm93XCI+XG4gICAgICAgIDxidXR0b24gY2xhc3M9XCJwcmltYXJ5XCIgaWQ9XCJzYXZlLXNldHRpbmdzLWJ0blwiPiR7aWNvbihcInNhdmVcIil9U2F2ZSBzZXR0aW5nczwvYnV0dG9uPlxuICAgICAgPC9kaXY+XG4gICAgPC9zZWN0aW9uPlxuICBgO1xufVxuXG5mdW5jdGlvbiByZW5kZXJEaWFnbm9zdGljc1RvZ2dsZSgpIHtcbiAgaWYgKCFzdGF0ZS50b29sQ2FsbHMubGVuZ3RoKSByZXR1cm4gXCJcIjtcblxuICByZXR1cm4gYFxuICAgIDxidXR0b24gY2xhc3M9XCJnaG9zdCBnaG9zdC1jb21wYWN0XCIgaWQ9XCJkaWFnbm9zdGljcy10b2dnbGVcIj5cbiAgICAgICR7aWNvbihcInRyYWNlXCIpfVxuICAgICAgJHtzdGF0ZS5kaWFnbm9zdGljc09wZW4gPyBcIkhpZGUgdHJhY2VcIiA6IGBUcmFjZSAoJHtzdGF0ZS50b29sQ2FsbHMubGVuZ3RofSlgfVxuICAgIDwvYnV0dG9uPlxuICBgO1xufVxuXG5mdW5jdGlvbiByZW5kZXJEaWFnbm9zdGljcygpIHtcbiAgaWYgKCFzdGF0ZS50b29sQ2FsbHMubGVuZ3RoIHx8ICFzdGF0ZS5kaWFnbm9zdGljc09wZW4pIHJldHVybiBcIlwiO1xuXG4gIHJldHVybiBgXG4gICAgPHNlY3Rpb24gY2xhc3M9XCJ0cmFjZS1jYXJkXCI+XG4gICAgICA8ZGl2IGNsYXNzPVwidHJhY2UtbGlzdFwiPlxuICAgICAgICAke3N0YXRlLnRvb2xDYWxsc1xuICAgICAgICAgIC5tYXAoXG4gICAgICAgICAgICAodG9vbENhbGwpID0+IGBcbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRyYWNlLXJvd1wiPlxuICAgICAgICAgICAgICAgIDxzdHJvbmc+JHtlc2NhcGVIdG1sKHRvb2xDYWxsLm5hbWUpfTwvc3Ryb25nPlxuICAgICAgICAgICAgICAgIDxzcGFuPiR7ZXNjYXBlSHRtbCh0b29sQ2FsbC5zdW1tYXJ5KX08L3NwYW4+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgYCxcbiAgICAgICAgICApXG4gICAgICAgICAgLmpvaW4oXCJcIil9XG4gICAgICA8L2Rpdj5cbiAgICA8L3NlY3Rpb24+XG4gIGA7XG59XG5cbmZ1bmN0aW9uIHJlbmRlclVuaWZpZWRSZXN1bHRzKCkge1xuICBpZiAoIXN0YXRlLnJlc3VsdFNlY3Rpb25zLmxlbmd0aCkge1xuICAgIHJldHVybiBgXG4gICAgICA8c2VjdGlvbiBjbGFzcz1cInJlc3VsdHMtc3RyZWFtIGVtcHR5LXN0YXRlXCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJlbXB0eS1pbGx1c3RyYXRpb25cIj4ke2ljb24oXCJlbXB0eVwiKX08L2Rpdj5cbiAgICAgICAgPGgzPlJlc3VsdHMgd2lsbCBsYW5kIGhlcmU8L2gzPlxuICAgICAgICA8cD5PbmNlIHRoZSBhc3Npc3RhbnQgZmluZHMgbGl2ZSBpbnZlbnRvcnksIHlvdSdsbCBnZXQgb3B0aW9ucyB5b3UgY2FuIG9wZW4gb3IgdXNlIGFzIHRoZSBuZXh0IHN0ZXAgaW4gdGhlIGNvbnZlcnNhdGlvbi48L3A+XG4gICAgICA8L3NlY3Rpb24+XG4gICAgYDtcbiAgfVxuXG4gIHJldHVybiBgXG4gICAgPHNlY3Rpb24gY2xhc3M9XCJyZXN1bHRzLXN0cmVhbVwiPlxuICAgICAgJHtzdGF0ZS5yZXN1bHRTZWN0aW9uc1xuICAgICAgICAubWFwKFxuICAgICAgICAgIChzZWN0aW9uKSA9PiBgXG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwicmVzdWx0LWdyb3VwXCI+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJzZWN0aW9uLWhlYWRcIj5cbiAgICAgICAgICAgICAgICA8aDM+JHtpY29uKHNlY3Rpb24ua2luZCl9JHtlc2NhcGVIdG1sKHNlY3Rpb24udGl0bGUpfTwvaDM+XG4gICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJiYWRnZSBiYWRnZS0ke3NlY3Rpb24ua2luZH1cIj4ke3NlY3Rpb24uaXRlbXMubGVuZ3RofSBvcHRpb25zPC9zcGFuPlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInJlc3VsdC1ncmlkXCI+XG4gICAgICAgICAgICAgICAgJHtzZWN0aW9uLml0ZW1zLm1hcCgoaXRlbSkgPT4gcmVuZGVyUmVzdWx0Q2FyZChpdGVtLCBzZWN0aW9uKSkuam9pbihcIlwiKX1cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICBgLFxuICAgICAgICApXG4gICAgICAgIC5qb2luKFwiXCIpfVxuICAgIDwvc2VjdGlvbj5cbiAgYDtcbn1cblxuZnVuY3Rpb24gcmVuZGVyUmVzdWx0Q2FyZChpdGVtOiBSZXN1bHRJdGVtLCBzZWN0aW9uOiBSZXN1bHRTZWN0aW9uKSB7XG4gIGNvbnN0IGZvbGxvd1VwID0gYnVpbGRGb2xsb3dVcChpdGVtLCBzZWN0aW9uKTtcbiAgY29uc3Qgcm9vdFRhZyA9IGl0ZW0uY3RhVXJsID8gXCJhXCIgOiBcImFydGljbGVcIjtcbiAgY29uc3Qgcm9vdEF0dHJpYnV0ZXMgPSBpdGVtLmN0YVVybFxuICAgID8gYGhyZWY9XCIke2VzY2FwZUF0dHJpYnV0ZShpdGVtLmN0YVVybCl9XCIgdGFyZ2V0PVwiX2JsYW5rXCIgcmVsPVwibm9yZWZlcnJlclwiIGNsYXNzPVwicmVzdWx0LWNhcmQgcmVzdWx0LWNhcmQtbGluayByZXN1bHQtY2FyZC0ke2l0ZW0uYWNjZW50ID8/IHNlY3Rpb24ua2luZH1cImBcbiAgICA6IGBjbGFzcz1cInJlc3VsdC1jYXJkIHJlc3VsdC1jYXJkLSR7aXRlbS5hY2NlbnQgPz8gc2VjdGlvbi5raW5kfVwiYDtcblxuICByZXR1cm4gYFxuICAgIDwke3Jvb3RUYWd9ICR7cm9vdEF0dHJpYnV0ZXN9PlxuICAgICAgJHtpdGVtLmltYWdlVXJsID8gYDxkaXYgY2xhc3M9XCJyZXN1bHQtaW1hZ2VcIiBzdHlsZT1cImJhY2tncm91bmQtaW1hZ2U6dXJsKCcke2VzY2FwZUF0dHJpYnV0ZShpdGVtLmltYWdlVXJsKX0nKVwiPjwvZGl2PmAgOiBcIlwifVxuICAgICAgPGRpdiBjbGFzcz1cInJlc3VsdC1ib2R5XCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJyZXN1bHQtdG9wXCI+XG4gICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgIDxoND4ke2VzY2FwZUh0bWwoaXRlbS50aXRsZSl9PC9oND5cbiAgICAgICAgICAgICR7aXRlbS5zdWJ0aXRsZSA/IGA8cCBjbGFzcz1cInN1YnRpdGxlXCI+JHtlc2NhcGVIdG1sKGl0ZW0uc3VidGl0bGUpfTwvcD5gIDogXCJcIn1cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAke2l0ZW0ucHJpY2UgPyBgPHN0cm9uZyBjbGFzcz1cInByaWNlXCI+JHtlc2NhcGVIdG1sKGl0ZW0ucHJpY2UpfTwvc3Ryb25nPmAgOiBcIlwifVxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgJHtcbiAgICAgICAgICBpdGVtLm1ldGE/Lmxlbmd0aFxuICAgICAgICAgICAgPyBgPGRpdiBjbGFzcz1cIm1ldGEtcm93XCI+JHtpdGVtLm1ldGEubWFwKChtZXRhKSA9PiBgPHNwYW4+JHtlc2NhcGVIdG1sKG1ldGEpfTwvc3Bhbj5gKS5qb2luKFwiXCIpfTwvZGl2PmBcbiAgICAgICAgICAgIDogXCJcIlxuICAgICAgICB9XG5cbiAgICAgICAgJHtpdGVtLmRlc2NyaXB0aW9uID8gYDxkaXYgY2xhc3M9XCJkZXNjcmlwdGlvbiBtYXJrZG93bi1ib2R5XCI+JHtyZW5kZXJIdG1sRGVzY3JpcHRpb24oaXRlbS5kZXNjcmlwdGlvbil9PC9kaXY+YCA6IFwiXCJ9XG4gICAgICAgIDxkaXYgY2xhc3M9XCJjYXJkLWFjdGlvbnNcIj5cbiAgICAgICAgICAke1xuICAgICAgICAgICAgaXRlbS5jdGFVcmxcbiAgICAgICAgICAgICAgPyBgPHNwYW4gY2xhc3M9XCJjYXJkLWxpbmstaGludFwiPiR7aWNvbihcIm9wZW5cIil9ICR7ZXNjYXBlSHRtbChpdGVtLmN0YUxhYmVsID8/IFwiT3BlbiBvcHRpb25cIil9PC9zcGFuPmBcbiAgICAgICAgICAgICAgOiBgPGJ1dHRvbiBjbGFzcz1cImdob3N0IGdob3N0LWNvbXBhY3QgcmVzdWx0LWFjdGlvblwiIGRhdGEtZm9sbG93dXA9XCIke2VzY2FwZUF0dHJpYnV0ZShmb2xsb3dVcCl9XCI+JHtpY29uKFwidXNlXCIpfVVzZSB0aGlzIG9wdGlvbjwvYnV0dG9uPmBcbiAgICAgICAgICB9XG4gICAgICAgICAgPGJ1dHRvbiBjbGFzcz1cImdob3N0IGdob3N0LWNvbXBhY3QgcmVzdWx0LWFjdGlvblwiIGRhdGEtZm9sbG93dXA9XCIke2VzY2FwZUF0dHJpYnV0ZShmb2xsb3dVcCl9XCI+JHtpY29uKFwic3BhcmtcIil9QXNrIGFib3V0IHRoaXM8L2J1dHRvbj5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICA8LyR7cm9vdFRhZ30+XG4gIGA7XG59XG5cbmZ1bmN0aW9uIGJ1aWxkRm9sbG93VXAoaXRlbTogUmVzdWx0SXRlbSwgc2VjdGlvbjogUmVzdWx0U2VjdGlvbikge1xuICBjb25zdCBzdWJqZWN0ID0gaXRlbS50aXRsZSB8fCBzZWN0aW9uLnRpdGxlO1xuICBpZiAoc2VjdGlvbi5raW5kID09PSBcImhvdGVsXCIpIHJldHVybiBgU2hvdyBtZSBtb3JlIGRldGFpbHMgZm9yICR7c3ViamVjdH0gYW5kIGhlbHAgbWUgYm9vayBpdC5gO1xuICBpZiAoc2VjdGlvbi5raW5kID09PSBcImZsaWdodFwiKSByZXR1cm4gYENvbXBhcmUgdGhpcyBmbGlnaHQgb3B0aW9uOiAke3N1YmplY3R9LCB0aGVuIGhlbHAgbWUgYm9vayB0aGUgYmVzdCBvbmUuYDtcbiAgaWYgKHNlY3Rpb24ua2luZCA9PT0gXCJjYXJcIikgcmV0dXJuIGBTaG93IG1lIG1vcmUgZGV0YWlscyBmb3IgdGhpcyBjYXIgb3B0aW9uOiAke3N1YmplY3R9LmA7XG4gIGlmIChzZWN0aW9uLmtpbmQgPT09IFwiYm9va2luZ1wiKSByZXR1cm4gYENvbnRpbnVlIHdpdGggJHtzdWJqZWN0fS5gO1xuICByZXR1cm4gYFRlbGwgbWUgbW9yZSBhYm91dCAke3N1YmplY3R9LmA7XG59XG5cbmZ1bmN0aW9uIHdpcmVFdmVudHMoKSB7XG4gIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIjc2V0dGluZ3MtdG9nZ2xlXCIpPy5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgIHN0YXRlLnNldHRpbmdzT3BlbiA9ICFzdGF0ZS5zZXR0aW5nc09wZW47XG4gICAgcmVuZGVyKCk7XG4gIH0pO1xuXG4gIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIjZGlhZ25vc3RpY3MtdG9nZ2xlXCIpPy5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgIHN0YXRlLmRpYWdub3N0aWNzT3BlbiA9ICFzdGF0ZS5kaWFnbm9zdGljc09wZW47XG4gICAgcmVuZGVyKCk7XG4gIH0pO1xuXG4gIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEJ1dHRvbkVsZW1lbnQ+KFwiW2RhdGEtbW9kZV1cIikuZm9yRWFjaCgoYnV0dG9uKSA9PiB7XG4gICAgYnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICBzdGF0ZS5zZWFyY2hNb2RlID0gYnV0dG9uLmRhdGFzZXQubW9kZSBhcyB0eXBlb2Ygc3RhdGUuc2VhcmNoTW9kZTtcbiAgICAgIHJlbmRlcigpO1xuICAgIH0pO1xuICB9KTtcblxuICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiI3Byb21wdFwiKT8uYWRkRXZlbnRMaXN0ZW5lcihcImlucHV0XCIsIChldmVudCkgPT4ge1xuICAgIHN0YXRlLnByb21wdERyYWZ0ID0gKGV2ZW50LnRhcmdldCBhcyBIVE1MVGV4dEFyZWFFbGVtZW50KS52YWx1ZTtcbiAgfSk7XG5cbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIiNzZWFyY2gtYnRuXCIpPy5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IHByb21wdCA9IHN0YXRlLnByb21wdERyYWZ0LnRyaW0oKTtcbiAgICBpZiAoIXByb21wdCkgcmV0dXJuO1xuXG4gICAgc3RhdGUubG9hZGluZyA9IHRydWU7XG4gICAgc3RhdGUuYXNzaXN0YW50TWVzc2FnZSA9IGBTZWFyY2hpbmcgJHtzdGF0ZS5zZWFyY2hNb2RlfS4uLmA7XG4gICAgcmVuZGVyKCk7XG5cbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHNlbmRSZXF1ZXN0KHtcbiAgICAgIHR5cGU6IFwiUk9VVEVTVEFDS19DSEFUXCIsXG4gICAgICB0YWJJZDogc3RhdGUudGFiSWQsXG4gICAgICBwcm9tcHQsXG4gICAgICBzZWFyY2hNb2RlOiBzdGF0ZS5zZWFyY2hNb2RlLFxuICAgIH0pO1xuXG4gICAgc3RhdGUubG9hZGluZyA9IGZhbHNlO1xuXG4gICAgaWYgKHJlc3BvbnNlLm9rKSB7XG4gICAgICBhcHBseVBheWxvYWQocmVzcG9uc2UpO1xuICAgIH0gZWxzZSB7XG4gICAgICBzdGF0ZS5hc3Npc3RhbnRNZXNzYWdlID0gcmVzcG9uc2UuZXJyb3I7XG4gICAgICBzdGF0ZS5zZXR0aW5ncyA9IHJlc3BvbnNlLnNldHRpbmdzID8/IHN0YXRlLnNldHRpbmdzO1xuICAgIH1cblxuICAgIHJlbmRlcigpO1xuICB9KTtcblxuICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxCdXR0b25FbGVtZW50PihcIi5yZXN1bHQtYWN0aW9uXCIpLmZvckVhY2goKGJ1dHRvbikgPT4ge1xuICAgIGJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgc3RhdGUucHJvbXB0RHJhZnQgPSBidXR0b24uZGF0YXNldC5mb2xsb3d1cCA/PyBcIlwiO1xuICAgICAgcmVuZGVyKCk7XG4gICAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yPEhUTUxUZXh0QXJlYUVsZW1lbnQ+KFwiI3Byb21wdFwiKT8uZm9jdXMoKTtcbiAgICB9KTtcbiAgfSk7XG5cbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIiNyZXNldC1idG5cIik/LmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBhc3luYyAoKSA9PiB7XG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBzZW5kUmVxdWVzdCh7XG4gICAgICB0eXBlOiBcIlJPVVRFU1RBQ0tfUkVTRVRcIixcbiAgICAgIHRhYklkOiBzdGF0ZS50YWJJZCxcbiAgICB9KTtcblxuICAgIGlmIChyZXNwb25zZS5vaykge1xuICAgICAgYXBwbHlQYXlsb2FkKHJlc3BvbnNlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RhdGUuYXNzaXN0YW50TWVzc2FnZSA9IHJlc3BvbnNlLmVycm9yO1xuICAgIH1cblxuICAgIHN0YXRlLnByb21wdERyYWZ0ID0gXCJcIjtcbiAgICByZW5kZXIoKTtcbiAgfSk7XG5cbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIiNzYXZlLXNldHRpbmdzLWJ0blwiKT8uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGFzeW5jICgpID0+IHtcbiAgICBjb25zdCBzZXR0aW5ncyA9IGNvbGxlY3RTZXR0aW5nc0Zvcm0oKTtcbiAgICBzdGF0ZS5zZXR0aW5ncyA9IGF3YWl0IHNhdmVTZXR0aW5ncyhzZXR0aW5ncyk7XG4gICAgc3RhdGUuc2V0dGluZ3NJc3N1ZXMgPSBbXTtcbiAgICBzdGF0ZS5hc3Npc3RhbnRNZXNzYWdlID0gXCJTZXR0aW5ncyBzYXZlZC4gWW91IGNhbiBydW4gYSBsaXZlIHNlYXJjaCBub3cuXCI7XG4gICAgcmVuZGVyKCk7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBjb2xsZWN0U2V0dGluZ3NGb3JtKCk6IFBhcnRpYWw8RXh0ZW5zaW9uU2V0dGluZ3M+IHtcbiAgcmV0dXJuIHtcbiAgICByb3V0ZXN0YWNrOiB7XG4gICAgICBhcGlLZXk6IHZhbHVlT2YoXCIjcm91dGVzdGFjay1hcGkta2V5XCIpLFxuICAgICAgYXBpU2VjcmV0OiB2YWx1ZU9mKFwiI3JvdXRlc3RhY2stYXBpLXNlY3JldFwiKSxcbiAgICAgIG1jcFVybDogdmFsdWVPZihcIiNyb3V0ZXN0YWNrLW1jcC11cmxcIiksXG4gICAgfSxcbiAgICBsbG06IHtcbiAgICAgIHByb3ZpZGVyOiB2YWx1ZU9mKFwiI2xsbS1wcm92aWRlclwiKSBhcyBFeHRlbnNpb25TZXR0aW5nc1tcImxsbVwiXVtcInByb3ZpZGVyXCJdLFxuICAgICAgb3BlbmFpOiB7XG4gICAgICAgIGFwaUtleTogdmFsdWVPZihcIiNvcGVuYWktYXBpLWtleVwiKSxcbiAgICAgICAgbW9kZWw6IHZhbHVlT2YoXCIjb3BlbmFpLW1vZGVsXCIpLFxuICAgICAgfSxcbiAgICAgIGFudGhyb3BpYzoge1xuICAgICAgICBhcGlLZXk6IHZhbHVlT2YoXCIjYW50aHJvcGljLWFwaS1rZXlcIiksXG4gICAgICAgIG1vZGVsOiB2YWx1ZU9mKFwiI2FudGhyb3BpYy1tb2RlbFwiKSxcbiAgICAgIH0sXG4gICAgICBtaXN0cmFsOiB7XG4gICAgICAgIGFwaUtleTogdmFsdWVPZihcIiNtaXN0cmFsLWFwaS1rZXlcIiksXG4gICAgICAgIG1vZGVsOiB2YWx1ZU9mKFwiI21pc3RyYWwtbW9kZWxcIiksXG4gICAgICAgIGJhc2VVcmw6IHZhbHVlT2YoXCIjbWlzdHJhbC1iYXNlLXVybFwiKSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gc2VuZFJlcXVlc3QocmVxdWVzdDogUGFuZWxSZXF1ZXN0KTogUHJvbWlzZTxQYW5lbFJlc3BvbnNlPiB7XG4gIHJldHVybiBjaHJvbWUucnVudGltZS5zZW5kTWVzc2FnZShyZXF1ZXN0KSBhcyBQcm9taXNlPFBhbmVsUmVzcG9uc2U+O1xufVxuXG5mdW5jdGlvbiBhcHBseVBheWxvYWQocmVzcG9uc2U6IEV4dHJhY3Q8UGFuZWxSZXNwb25zZSwgeyBvazogdHJ1ZSB9Pikge1xuICBzdGF0ZS5hc3Npc3RhbnRNZXNzYWdlID0gcmVzcG9uc2UucGF5bG9hZC5hc3Npc3RhbnRNZXNzYWdlO1xuICBzdGF0ZS5yZXN1bHRTZWN0aW9ucyA9IHJlc3BvbnNlLnBheWxvYWQucmVzdWx0U2VjdGlvbnM7XG4gIHN0YXRlLnRvb2xDYWxscyA9IHJlc3BvbnNlLnBheWxvYWQudG9vbENhbGxzLm1hcCgodG9vbENhbGwpID0+ICh7XG4gICAgbmFtZTogdG9vbENhbGwubmFtZSxcbiAgICBzdW1tYXJ5OiB0b29sQ2FsbC5zdW1tYXJ5LFxuICB9KSk7XG4gIHN0YXRlLnNldHRpbmdzSXNzdWVzID0gcmVzcG9uc2UucGF5bG9hZC5zZXR0aW5nc0lzc3VlcztcbiAgc3RhdGUuc2V0dGluZ3MgPSByZXNwb25zZS5zZXR0aW5ncztcblxuICBpZiAoIXJlc3BvbnNlLnBheWxvYWQucGFnZUNvbnRleHQpIHtcbiAgICBzdGF0ZS5wYWdlU3VtbWFyeSA9IFwiXCI7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3QgaGludHMgPSByZXNwb25zZS5wYXlsb2FkLnBhZ2VDb250ZXh0LnRyYXZlbEhpbnRzLmpvaW4oXCIgfCBcIikgfHwgXCJObyB0cmF2ZWwgaGludHMgZm91bmQgb24gdGhlIHBhZ2UuXCI7XG4gIHN0YXRlLnBhZ2VTdW1tYXJ5ID0gYCR7cmVzcG9uc2UucGF5bG9hZC5wYWdlQ29udGV4dC50aXRsZX0gfCAke2hpbnRzfWA7XG59XG5cbmZ1bmN0aW9uIHZhbHVlT2Yoc2VsZWN0b3I6IHN0cmluZyk6IHN0cmluZyB7XG4gIGNvbnN0IGVsZW1lbnQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yPEhUTUxJbnB1dEVsZW1lbnQgfCBIVE1MU2VsZWN0RWxlbWVudD4oc2VsZWN0b3IpO1xuICByZXR1cm4gZWxlbWVudD8udmFsdWUudHJpbSgpID8/IFwiXCI7XG59XG5cbmZ1bmN0aW9uIGNhcGl0YWxpemUodmFsdWU6IHN0cmluZykge1xuICByZXR1cm4gdmFsdWUuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyB2YWx1ZS5zbGljZSgxKTtcbn1cblxuZnVuY3Rpb24gZXNjYXBlSHRtbCh2YWx1ZTogc3RyaW5nKSB7XG4gIHJldHVybiB2YWx1ZVxuICAgIC5yZXBsYWNlQWxsKFwiJlwiLCBcIiZhbXA7XCIpXG4gICAgLnJlcGxhY2VBbGwoXCI8XCIsIFwiJmx0O1wiKVxuICAgIC5yZXBsYWNlQWxsKFwiPlwiLCBcIiZndDtcIilcbiAgICAucmVwbGFjZUFsbCgnXCInLCBcIiZxdW90O1wiKVxuICAgIC5yZXBsYWNlQWxsKFwiJ1wiLCBcIiYjMzk7XCIpO1xufVxuXG5mdW5jdGlvbiByZW5kZXJIdG1sRGVzY3JpcHRpb24odmFsdWU6IHN0cmluZykge1xuICBjb25zdCB0ZW1wbGF0ZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJ0ZW1wbGF0ZVwiKTtcbiAgdGVtcGxhdGUuaW5uZXJIVE1MID0gdmFsdWU7XG5cbiAgY29uc3QgYWxsb3dlZFRhZ3MgPSBuZXcgU2V0KFtcbiAgICBcIlBcIixcbiAgICBcIkJSXCIsXG4gICAgXCJTVFJPTkdcIixcbiAgICBcIkJcIixcbiAgICBcIkVNXCIsXG4gICAgXCJJXCIsXG4gICAgXCJVTFwiLFxuICAgIFwiT0xcIixcbiAgICBcIkxJXCIsXG4gIF0pO1xuXG4gIGNvbnN0IHNhbml0aXplTm9kZSA9IChub2RlOiBOb2RlKTogc3RyaW5nID0+IHtcbiAgICBpZiAobm9kZS5ub2RlVHlwZSA9PT0gTm9kZS5URVhUX05PREUpIHtcbiAgICAgIHJldHVybiBlc2NhcGVIdG1sKG5vZGUudGV4dENvbnRlbnQgPz8gXCJcIik7XG4gICAgfVxuXG4gICAgaWYgKG5vZGUubm9kZVR5cGUgIT09IE5vZGUuRUxFTUVOVF9OT0RFKSB7XG4gICAgICByZXR1cm4gXCJcIjtcbiAgICB9XG5cbiAgICBjb25zdCBlbGVtZW50ID0gbm9kZSBhcyBIVE1MRWxlbWVudDtcbiAgICBjb25zdCB0YWcgPSBlbGVtZW50LnRhZ05hbWUudG9VcHBlckNhc2UoKTtcblxuICAgIGNvbnN0IGNoaWxkcmVuID0gQXJyYXkuZnJvbShlbGVtZW50LmNoaWxkTm9kZXMpXG4gICAgICAubWFwKChjaGlsZCkgPT4gc2FuaXRpemVOb2RlKGNoaWxkKSlcbiAgICAgIC5qb2luKFwiXCIpO1xuXG4gICAgaWYgKCFhbGxvd2VkVGFncy5oYXModGFnKSkge1xuICAgICAgcmV0dXJuIGNoaWxkcmVuO1xuICAgIH1cblxuICAgIGNvbnN0IHRhZ05hbWUgPSB0YWcudG9Mb3dlckNhc2UoKTtcbiAgICByZXR1cm4gYDwke3RhZ05hbWV9PiR7Y2hpbGRyZW59PC8ke3RhZ05hbWV9PmA7XG4gIH07XG5cbiAgcmV0dXJuIEFycmF5LmZyb20odGVtcGxhdGUuY29udGVudC5jaGlsZE5vZGVzKVxuICAgIC5tYXAoKG5vZGUpID0+IHNhbml0aXplTm9kZShub2RlKSlcbiAgICAuam9pbihcIlwiKTtcbn1cblxuZnVuY3Rpb24gZXNjYXBlQXR0cmlidXRlKHZhbHVlOiBzdHJpbmcpIHtcbiAgcmV0dXJuIGVzY2FwZUh0bWwodmFsdWUpO1xufVxuXG5mdW5jdGlvbiByZW5kZXJSaWNoVGV4dCh2YWx1ZTogc3RyaW5nKSB7XG4gIGNvbnN0IGJsb2NrcyA9IHZhbHVlLnJlcGxhY2UoL1xcclxcbi9nLCBcIlxcblwiKS5zcGxpdCgvXFxuezIsfS8pLm1hcCgoYmxvY2spID0+IGJsb2NrLnRyaW0oKSkuZmlsdGVyKEJvb2xlYW4pO1xuICByZXR1cm4gYmxvY2tzLm1hcChyZW5kZXJCbG9jaykuam9pbihcIlwiKTtcbn1cblxuZnVuY3Rpb24gcmVuZGVyQmxvY2soYmxvY2s6IHN0cmluZykge1xuICBjb25zdCBsaW5lcyA9IGJsb2NrLnNwbGl0KFwiXFxuXCIpLm1hcCgobGluZSkgPT4gbGluZS50cmltKCkpLmZpbHRlcihCb29sZWFuKTtcbiAgaWYgKCFsaW5lcy5sZW5ndGgpIHJldHVybiBcIlwiO1xuXG4gIGlmIChsaW5lcy5ldmVyeSgobGluZSkgPT4gL15bLSpcdTIwMjJdXFxzKy8udGVzdChsaW5lKSkpIHtcbiAgICByZXR1cm4gYDx1bD4ke2xpbmVzLm1hcCgobGluZSkgPT4gYDxsaT4ke3JlbmRlcklubGluZShsaW5lLnJlcGxhY2UoL15bLSpcdTIwMjJdXFxzKy8sIFwiXCIpKX08L2xpPmApLmpvaW4oXCJcIil9PC91bD5gO1xuICB9XG5cbiAgaWYgKGxpbmVzLmV2ZXJ5KChsaW5lKSA9PiAvXlxcZCtcXC5cXHMrLy50ZXN0KGxpbmUpKSkge1xuICAgIHJldHVybiBgPG9sPiR7bGluZXMubWFwKChsaW5lKSA9PiBgPGxpPiR7cmVuZGVySW5saW5lKGxpbmUucmVwbGFjZSgvXlxcZCtcXC5cXHMrLywgXCJcIikpfTwvbGk+YCkuam9pbihcIlwiKX08L29sPmA7XG4gIH1cblxuICByZXR1cm4gYDxwPiR7bGluZXMubWFwKHJlbmRlcklubGluZSkuam9pbihcIjxiciAvPlwiKX08L3A+YDtcbn1cblxuZnVuY3Rpb24gcmVuZGVySW5saW5lKHZhbHVlOiBzdHJpbmcpIHtcbiAgY29uc3QgaW1hZ2VQYXR0ZXJuID0gLyFcXFsoW15cXF1dKilcXF1cXCgoaHR0cHM/OlxcL1xcL1teXFxzKV0rKVxcKS9nO1xuICBjb25zdCBsaW5rUGF0dGVybiA9IC9cXFsoW15cXF1dKylcXF1cXCgoaHR0cHM/OlxcL1xcL1teXFxzKV0rKVxcKS9nO1xuICBjb25zdCB1cmxQYXR0ZXJuID0gLyhefFtcXHMoXSkoaHR0cHM/OlxcL1xcL1teXFxzPF0rKS9nO1xuXG4gIGxldCBodG1sID0gZXNjYXBlSHRtbCh2YWx1ZSk7XG4gIGh0bWwgPSBodG1sLnJlcGxhY2UoaW1hZ2VQYXR0ZXJuLCAoX21hdGNoLCBhbHQsIHVybCkgPT4ge1xuICAgIGNvbnN0IHNhZmVBbHQgPSBlc2NhcGVBdHRyaWJ1dGUoYWx0KTtcbiAgICBjb25zdCBzYWZlVXJsID0gZXNjYXBlQXR0cmlidXRlKHVybCk7XG4gICAgcmV0dXJuIGA8ZmlndXJlIGNsYXNzPVwibWFya2Rvd24taW1hZ2VcIj48aW1nIHNyYz1cIiR7c2FmZVVybH1cIiBhbHQ9XCIke3NhZmVBbHR9XCIgbG9hZGluZz1cImxhenlcIiAvPjxmaWdjYXB0aW9uPiR7c2FmZUFsdH08L2ZpZ2NhcHRpb24+PC9maWd1cmU+YDtcbiAgfSk7XG4gIGh0bWwgPSBodG1sLnJlcGxhY2UobGlua1BhdHRlcm4sIChfbWF0Y2gsIGxhYmVsLCB1cmwpID0+IHtcbiAgICBjb25zdCBzYWZlTGFiZWwgPSBlc2NhcGVIdG1sKGxhYmVsKTtcbiAgICBjb25zdCBzYWZlVXJsID0gZXNjYXBlQXR0cmlidXRlKHVybCk7XG4gICAgcmV0dXJuIGA8YSBocmVmPVwiJHtzYWZlVXJsfVwiIHRhcmdldD1cIl9ibGFua1wiIHJlbD1cIm5vcmVmZXJyZXJcIj4ke3NhZmVMYWJlbH08L2E+YDtcbiAgfSk7XG4gIGh0bWwgPSBodG1sLnJlcGxhY2UodXJsUGF0dGVybiwgKF9tYXRjaCwgcHJlZml4LCB1cmwpID0+IHtcbiAgICBjb25zdCBzYWZlVXJsID0gZXNjYXBlQXR0cmlidXRlKHVybCk7XG4gICAgcmV0dXJuIGAke3ByZWZpeH08YSBocmVmPVwiJHtzYWZlVXJsfVwiIHRhcmdldD1cIl9ibGFua1wiIHJlbD1cIm5vcmVmZXJyZXJcIj4ke3NhZmVVcmx9PC9hPmA7XG4gIH0pO1xuICBodG1sID0gaHRtbC5yZXBsYWNlKC9cXCpcXCooW14qXSspXFwqXFwqL2csIFwiPHN0cm9uZz4kMTwvc3Ryb25nPlwiKTtcbiAgaHRtbCA9IGh0bWwucmVwbGFjZSgvKF58W1xccz5dKVxcKihbXipdKylcXCooPz0kfFtcXHM8XSkvZywgXCIkMTxlbT4kMjwvZW0+XCIpO1xuICBodG1sID0gaHRtbC5yZXBsYWNlKC9gKFteYF0rKWAvZywgXCI8Y29kZT4kMTwvY29kZT5cIik7XG4gIHJldHVybiBodG1sO1xufVxuXG5mdW5jdGlvbiBpY29uKG5hbWU6IHN0cmluZykge1xuICBjb25zdCBpY29uczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgICBob3RlbHM6IGA8c3ZnIHZpZXdCb3g9XCIwIDAgMjAgMjBcIiBhcmlhLWhpZGRlbj1cInRydWVcIj48cGF0aCBkPVwiTTMgMTVWNWgzYTIgMiAwIDAgMSAyIDJ2MWg1YTQgNCAwIDAgMSA0IDR2M2gtMnYtMkg1djJIM1ptNS01VjdhMSAxIDAgMCAwLTEtMUg1djRoM1ptMiAwaDVhMiAyIDAgMSAwIDAtNGgtNXY0WlwiLz48L3N2Zz5gLFxuICAgIGZsaWdodHM6IGA8c3ZnIHZpZXdCb3g9XCIwIDAgMjAgMjBcIiBhcmlhLWhpZGRlbj1cInRydWVcIj48cGF0aCBkPVwibTE4IDEwLTcgMi0zIDUtMS0uMyAxLjItNS4xTDQgMTAuNVY5LjRsNC4yLTEuMUw3IDMuMiA4IDNsMyA1IDcgMlpcIi8+PC9zdmc+YCxcbiAgICBjYXJzOiBgPHN2ZyB2aWV3Qm94PVwiMCAwIDIwIDIwXCIgYXJpYS1oaWRkZW49XCJ0cnVlXCI+PHBhdGggZD1cIk01IDE0YTEuNSAxLjUgMCAxIDEgMCAzIDEuNSAxLjUgMCAwIDEgMC0zWm0xMCAwYTEuNSAxLjUgMCAxIDEgMCAzIDEuNSAxLjUgMCAwIDEgMC0zWk00LjEgMTEgNS43IDYuOEEyIDIgMCAwIDEgNy42IDUuNWg0LjhhMiAyIDAgMCAxIDEuOSAxLjNMMTUuOSAxMUgxN2ExIDEgMCAwIDEgMSAxdjJoLTFhMiAyIDAgMCAwLTQgMEg3YTIgMiAwIDAgMC00IDBIMnYtMmExIDEgMCAwIDEgMS0xaDEuMVpNNi4zIDExaDcuNGwtMS4yLTMuMmExIDEgMCAwIDAtLjktLjZIOC40YTEgMSAwIDAgMC0uOS42TDYuMyAxMVpcIi8+PC9zdmc+YCxcbiAgICBib29raW5nOiBgPHN2ZyB2aWV3Qm94PVwiMCAwIDIwIDIwXCIgYXJpYS1oaWRkZW49XCJ0cnVlXCI+PHBhdGggZD1cIk00IDRoMTJ2MTJINFY0Wm0yIDJ2OGg4VjZINlptMSAyaDZ2MUg3VjhabTAgMmg0djFIN3YtMVpcIi8+PC9zdmc+YCxcbiAgICBob3RlbDogYDxzdmcgdmlld0JveD1cIjAgMCAyMCAyMFwiIGFyaWEtaGlkZGVuPVwidHJ1ZVwiPjxwYXRoIGQ9XCJNMyAxNVY1aDNhMiAyIDAgMCAxIDIgMnYxaDVhNCA0IDAgMCAxIDQgNHYzaC0ydi0ySDV2MkgzWlwiLz48L3N2Zz5gLFxuICAgIGZsaWdodDogYDxzdmcgdmlld0JveD1cIjAgMCAyMCAyMFwiIGFyaWEtaGlkZGVuPVwidHJ1ZVwiPjxwYXRoIGQ9XCJtMTggMTAtNyAyLTMgNS0xLS4zIDEuMi01LjFMNCAxMC41VjkuNGw0LjItMS4xTDcgMy4yIDggM2wzIDUgNyAyWlwiLz48L3N2Zz5gLFxuICAgIGNhcjogYDxzdmcgdmlld0JveD1cIjAgMCAyMCAyMFwiIGFyaWEtaGlkZGVuPVwidHJ1ZVwiPjxwYXRoIGQ9XCJNNC4xIDExIDUuNyA2LjhBMiAyIDAgMCAxIDcuNiA1LjVoNC44YTIgMiAwIDAgMSAxLjkgMS4zTDE1LjkgMTFIMTdhMSAxIDAgMCAxIDEgMXYyaC0xYTIgMiAwIDAgMC00IDBIN2EyIDIgMCAwIDAtNCAwSDJ2LTJhMSAxIDAgMCAxIDEtMWgxLjFaXCIvPjwvc3ZnPmAsXG4gICAgY29udGV4dDogYDxzdmcgdmlld0JveD1cIjAgMCAyMCAyMFwiIGFyaWEtaGlkZGVuPVwidHJ1ZVwiPjxwYXRoIGQ9XCJNMTAgMmE2IDYgMCAwIDEgNiA2YzAgNC40LTYgMTAtNiAxMFM0IDEyLjQgNCA4YTYgNiAwIDAgMSA2LTZabTAgMy4yQTIuOCAyLjggMCAxIDAgMTAgMTAuOGEyLjggMi44IDAgMCAwIDAtNS42WlwiLz48L3N2Zz5gLFxuICAgIHNwYXJrOiBgPHN2ZyB2aWV3Qm94PVwiMCAwIDIwIDIwXCIgYXJpYS1oaWRkZW49XCJ0cnVlXCI+PHBhdGggZD1cIm0xMCAyIDEuNyA0LjhMMTYuNSA4bC00LjggMS4yTDEwIDE0bC0xLjctNC44TDMuNSA4bDQuOC0xLjJMMTAgMlptNS41IDEwIDEgMi43IDIuNS44LTIuNS43LTEgMi44LTEtMi44LTIuNS0uNyAyLjUtLjggMS0yLjdaXCIvPjwvc3ZnPmAsXG4gICAgdHJhY2U6IGA8c3ZnIHZpZXdCb3g9XCIwIDAgMjAgMjBcIiBhcmlhLWhpZGRlbj1cInRydWVcIj48cGF0aCBkPVwiTTMgNGgxNHYySDNWNFptMCA1aDl2MkgzVjlabTAgNWgxNHYySDN2LTJabTExLTVoM3YyaC0zVjlaXCIvPjwvc3ZnPmAsXG4gICAgc2VuZDogYDxzdmcgdmlld0JveD1cIjAgMCAyMCAyMFwiIGFyaWEtaGlkZGVuPVwidHJ1ZVwiPjxwYXRoIGQ9XCJNMyAxNyAxOCAxMCAzIDNsMS42IDUuNEwxMiAxMCA0LjYgMTEuNiAzIDE3WlwiLz48L3N2Zz5gLFxuICAgIHNhdmU6IGA8c3ZnIHZpZXdCb3g9XCIwIDAgMjAgMjBcIiBhcmlhLWhpZGRlbj1cInRydWVcIj48cGF0aCBkPVwiTTQgM2g5bDMgM3YxMUg0VjNabTIgMnYzaDdWNUg2Wm0wIDd2M2g4di0zSDZaXCIvPjwvc3ZnPmAsXG4gICAgb3BlbjogYDxzdmcgdmlld0JveD1cIjAgMCAyMCAyMFwiIGFyaWEtaGlkZGVuPVwidHJ1ZVwiPjxwYXRoIGQ9XCJNMTEgNGg1djVoLTJWNy40bC01LjMgNS4zLTEuNC0xLjRMMTIuNiA2SDExVjRaTTUgNmg0djJIN3Y2aDZ2LTJoMnY0SDVWNlpcIi8+PC9zdmc+YCxcbiAgICB1c2U6IGA8c3ZnIHZpZXdCb3g9XCIwIDAgMjAgMjBcIiBhcmlhLWhpZGRlbj1cInRydWVcIj48cGF0aCBkPVwibTguNCAxMy42LTMtMyAxLjQtMS40IDEuNiAxLjYgNC44LTQuOCAxLjQgMS40LTYuMiA2LjJaXCIvPjwvc3ZnPmAsXG4gICAgZW1wdHk6IGA8c3ZnIHZpZXdCb3g9XCIwIDAgMjAgMjBcIiBhcmlhLWhpZGRlbj1cInRydWVcIj48cGF0aCBkPVwiTTQgNWgxMnYxMEg0VjVabTIgMnY2aDhWN0g2Wm0xIDFoNnYxSDdWOFptMCAyaDR2MUg3di0xWlwiLz48L3N2Zz5gLFxuICB9O1xuXG4gIHJldHVybiBgPHNwYW4gY2xhc3M9XCJpY29uIGljb24tJHtlc2NhcGVBdHRyaWJ1dGUobmFtZSl9XCI+JHtpY29uc1tuYW1lXSA/PyBpY29ucy5zcGFya308L3NwYW4+YDtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBTyxJQUFNLGdCQUFnQjtBQUFBLEVBQzNCLFlBQVksRUFBRSxRQUFRLHdDQUF3QyxXQUFXLG9FQUFvRSxRQUFRLGdDQUFnQztBQUFBLEVBQ3JMLEtBQUs7QUFBQSxJQUNILFVBQVU7QUFBQSxJQUNWLFFBQVEsRUFBRSxRQUFRLHdCQUF3QixPQUFPLFNBQVM7QUFBQSxJQUMxRCxXQUFXLEVBQUUsUUFBUSxJQUFJLE9BQU8sMkJBQTJCO0FBQUEsSUFDM0QsU0FBUyxFQUFFLFFBQVEsb0NBQW9DLE9BQU8sd0JBQXdCLFNBQVMsNEJBQTRCO0FBQUEsRUFDN0g7QUFDRjs7O0FDb0JBLElBQU0sV0FBOEI7QUFBQSxFQUNsQyxZQUFZO0FBQUEsSUFDVixRQUFRLGNBQWMsV0FBVztBQUFBLElBQ2pDLFdBQVcsY0FBYyxXQUFXO0FBQUEsSUFDcEMsUUFBUSxjQUFjLFdBQVc7QUFBQSxFQUNuQztBQUFBLEVBQ0Es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
