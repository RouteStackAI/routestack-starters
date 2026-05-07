import type { PageContext } from "../lib/types.js";

chrome.runtime.onMessage.addListener((
  message: { type?: string },
  _sender: unknown,
  sendResponse: (response: PageContext) => void,
) => {
  if (message?.type !== "ROUTESTACK_EXTRACT_CONTEXT") return;
  sendResponse(extractPageContext());
});

function extractPageContext(): PageContext {
  const selection = window.getSelection()?.toString().trim() ?? "";
  const description =
    document.querySelector('meta[name="description"]')?.getAttribute("content")?.trim() ?? "";
  const headings = Array.from(document.querySelectorAll("h1, h2, h3"))
    .map((element) => element.textContent?.trim() ?? "")
    .filter(Boolean)
    .slice(0, 8);
  const bodyText = (document.body?.innerText ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 5000);

  const hintSource = [document.title, description, selection, headings.join(" "), bodyText.slice(0, 1500)]
    .filter(Boolean)
    .join(" ");

  return {
    url: location.href,
    title: document.title,
    selection,
    description,
    headings,
    textExcerpt: bodyText.slice(0, 1200),
    travelHints: extractTravelHints(hintSource),
  };
}

function extractTravelHints(source: string): string[] {
  const normalized = source.replace(/\s+/g, " ");
  const hints = new Set<string>();

  for (const match of normalized.match(/\b(?:from|to|in|at)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}/g) ?? []) {
    hints.add(match.trim());
  }

  for (const match of normalized.match(/\b(?:Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|September|Oct|October|Nov|November|Dec|December)\s+\d{1,2}(?:,\s+\d{4})?/g) ?? []) {
    hints.add(match.trim());
  }

  for (const match of normalized.match(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g) ?? []) {
    hints.add(match.trim());
  }

  return Array.from(hints).slice(0, 10);
}
