// src/content/extractor.ts
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "ROUTESTACK_EXTRACT_CONTEXT") return;
  sendResponse(extractPageContext());
});
function extractPageContext() {
  const selection = window.getSelection()?.toString().trim() ?? "";
  const description = document.querySelector('meta[name="description"]')?.getAttribute("content")?.trim() ?? "";
  const headings = Array.from(document.querySelectorAll("h1, h2, h3")).map((element) => element.textContent?.trim() ?? "").filter(Boolean).slice(0, 8);
  const bodyText = (document.body?.innerText ?? "").replace(/\s+/g, " ").trim().slice(0, 5e3);
  const hintSource = [document.title, description, selection, headings.join(" "), bodyText.slice(0, 1500)].filter(Boolean).join(" ");
  return {
    url: location.href,
    title: document.title,
    selection,
    description,
    headings,
    textExcerpt: bodyText.slice(0, 1200),
    travelHints: extractTravelHints(hintSource)
  };
}
function extractTravelHints(source) {
  const normalized = source.replace(/\s+/g, " ");
  const hints = /* @__PURE__ */ new Set();
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc3JjL2NvbnRlbnQvZXh0cmFjdG9yLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJpbXBvcnQgdHlwZSB7IFBhZ2VDb250ZXh0IH0gZnJvbSBcIi4uL2xpYi90eXBlcy5qc1wiO1xuXG5jaHJvbWUucnVudGltZS5vbk1lc3NhZ2UuYWRkTGlzdGVuZXIoKFxuICBtZXNzYWdlOiB7IHR5cGU/OiBzdHJpbmcgfSxcbiAgX3NlbmRlcjogdW5rbm93bixcbiAgc2VuZFJlc3BvbnNlOiAocmVzcG9uc2U6IFBhZ2VDb250ZXh0KSA9PiB2b2lkLFxuKSA9PiB7XG4gIGlmIChtZXNzYWdlPy50eXBlICE9PSBcIlJPVVRFU1RBQ0tfRVhUUkFDVF9DT05URVhUXCIpIHJldHVybjtcbiAgc2VuZFJlc3BvbnNlKGV4dHJhY3RQYWdlQ29udGV4dCgpKTtcbn0pO1xuXG5mdW5jdGlvbiBleHRyYWN0UGFnZUNvbnRleHQoKTogUGFnZUNvbnRleHQge1xuICBjb25zdCBzZWxlY3Rpb24gPSB3aW5kb3cuZ2V0U2VsZWN0aW9uKCk/LnRvU3RyaW5nKCkudHJpbSgpID8/IFwiXCI7XG4gIGNvbnN0IGRlc2NyaXB0aW9uID1cbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdtZXRhW25hbWU9XCJkZXNjcmlwdGlvblwiXScpPy5nZXRBdHRyaWJ1dGUoXCJjb250ZW50XCIpPy50cmltKCkgPz8gXCJcIjtcbiAgY29uc3QgaGVhZGluZ3MgPSBBcnJheS5mcm9tKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCJoMSwgaDIsIGgzXCIpKVxuICAgIC5tYXAoKGVsZW1lbnQpID0+IGVsZW1lbnQudGV4dENvbnRlbnQ/LnRyaW0oKSA/PyBcIlwiKVxuICAgIC5maWx0ZXIoQm9vbGVhbilcbiAgICAuc2xpY2UoMCwgOCk7XG4gIGNvbnN0IGJvZHlUZXh0ID0gKGRvY3VtZW50LmJvZHk/LmlubmVyVGV4dCA/PyBcIlwiKVxuICAgIC5yZXBsYWNlKC9cXHMrL2csIFwiIFwiKVxuICAgIC50cmltKClcbiAgICAuc2xpY2UoMCwgNTAwMCk7XG5cbiAgY29uc3QgaGludFNvdXJjZSA9IFtkb2N1bWVudC50aXRsZSwgZGVzY3JpcHRpb24sIHNlbGVjdGlvbiwgaGVhZGluZ3Muam9pbihcIiBcIiksIGJvZHlUZXh0LnNsaWNlKDAsIDE1MDApXVxuICAgIC5maWx0ZXIoQm9vbGVhbilcbiAgICAuam9pbihcIiBcIik7XG5cbiAgcmV0dXJuIHtcbiAgICB1cmw6IGxvY2F0aW9uLmhyZWYsXG4gICAgdGl0bGU6IGRvY3VtZW50LnRpdGxlLFxuICAgIHNlbGVjdGlvbixcbiAgICBkZXNjcmlwdGlvbixcbiAgICBoZWFkaW5ncyxcbiAgICB0ZXh0RXhjZXJwdDogYm9keVRleHQuc2xpY2UoMCwgMTIwMCksXG4gICAgdHJhdmVsSGludHM6IGV4dHJhY3RUcmF2ZWxIaW50cyhoaW50U291cmNlKSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gZXh0cmFjdFRyYXZlbEhpbnRzKHNvdXJjZTogc3RyaW5nKTogc3RyaW5nW10ge1xuICBjb25zdCBub3JtYWxpemVkID0gc291cmNlLnJlcGxhY2UoL1xccysvZywgXCIgXCIpO1xuICBjb25zdCBoaW50cyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG4gIGZvciAoY29uc3QgbWF0Y2ggb2Ygbm9ybWFsaXplZC5tYXRjaCgvXFxiKD86ZnJvbXx0b3xpbnxhdClcXHMrW0EtWl1bYS16XSsoPzpcXHMrW0EtWl1bYS16XSspezAsMn0vZykgPz8gW10pIHtcbiAgICBoaW50cy5hZGQobWF0Y2gudHJpbSgpKTtcbiAgfVxuXG4gIGZvciAoY29uc3QgbWF0Y2ggb2Ygbm9ybWFsaXplZC5tYXRjaCgvXFxiKD86SmFufEphbnVhcnl8RmVifEZlYnJ1YXJ5fE1hcnxNYXJjaHxBcHJ8QXByaWx8TWF5fEp1bnxKdW5lfEp1bHxKdWx5fEF1Z3xBdWd1c3R8U2VwfFNlcHRlbWJlcnxPY3R8T2N0b2JlcnxOb3Z8Tm92ZW1iZXJ8RGVjfERlY2VtYmVyKVxccytcXGR7MSwyfSg/OixcXHMrXFxkezR9KT8vZykgPz8gW10pIHtcbiAgICBoaW50cy5hZGQobWF0Y2gudHJpbSgpKTtcbiAgfVxuXG4gIGZvciAoY29uc3QgbWF0Y2ggb2Ygbm9ybWFsaXplZC5tYXRjaCgvXFxiXFxkezEsMn1cXC9cXGR7MSwyfSg/OlxcL1xcZHsyLDR9KT9cXGIvZykgPz8gW10pIHtcbiAgICBoaW50cy5hZGQobWF0Y2gudHJpbSgpKTtcbiAgfVxuXG4gIHJldHVybiBBcnJheS5mcm9tKGhpbnRzKS5zbGljZSgwLCAxMCk7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBRUEsT0FBTyxRQUFRLFVBQVUsWUFBWSxDQUNuQyxTQUNBLFNBQ0EsaUJBQ0c7QUFDSCxNQUFJLFNBQVMsU0FBUyw2QkFBOEI7QUFDcEQsZUFBYSxtQkFBbUIsQ0FBQztBQUNuQyxDQUFDO0FBRUQsU0FBUyxxQkFBa0M7QUFDekMsUUFBTSxZQUFZLE9BQU8sYUFBYSxHQUFHLFNBQVMsRUFBRSxLQUFLLEtBQUs7QUFDOUQsUUFBTSxjQUNKLFNBQVMsY0FBYywwQkFBMEIsR0FBRyxhQUFhLFNBQVMsR0FBRyxLQUFLLEtBQUs7QUFDekYsUUFBTSxXQUFXLE1BQU0sS0FBSyxTQUFTLGlCQUFpQixZQUFZLENBQUMsRUFDaEUsSUFBSSxDQUFDLFlBQVksUUFBUSxhQUFhLEtBQUssS0FBSyxFQUFFLEVBQ2xELE9BQU8sT0FBTyxFQUNkLE1BQU0sR0FBRyxDQUFDO0FBQ2IsUUFBTSxZQUFZLFNBQVMsTUFBTSxhQUFhLElBQzNDLFFBQVEsUUFBUSxHQUFHLEVBQ25CLEtBQUssRUFDTCxNQUFNLEdBQUcsR0FBSTtBQUVoQixRQUFNLGFBQWEsQ0FBQyxTQUFTLE9BQU8sYUFBYSxXQUFXLFNBQVMsS0FBSyxHQUFHLEdBQUcsU0FBUyxNQUFNLEdBQUcsSUFBSSxDQUFDLEVBQ3BHLE9BQU8sT0FBTyxFQUNkLEtBQUssR0FBRztBQUVYLFNBQU87QUFBQSxJQUNMLEtBQUssU0FBUztBQUFBLElBQ2QsT0FBTyxTQUFTO0FBQUEsSUFDaEI7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0EsYUFBYSxTQUFTLE1BQU0sR0FBRyxJQUFJO0FBQUEsSUFDbkMsYUFBYSxtQkFBbUIsVUFBVTtBQUFBLEVBQzVDO0FBQ0Y7QUFFQSxTQUFTLG1CQUFtQixRQUEwQjtBQUNwRCxRQUFNLGFBQWEsT0FBTyxRQUFRLFFBQVEsR0FBRztBQUM3QyxRQUFNLFFBQVEsb0JBQUksSUFBWTtBQUU5QixhQUFXLFNBQVMsV0FBVyxNQUFNLDJEQUEyRCxLQUFLLENBQUMsR0FBRztBQUN2RyxVQUFNLElBQUksTUFBTSxLQUFLLENBQUM7QUFBQSxFQUN4QjtBQUVBLGFBQVcsU0FBUyxXQUFXLE1BQU0sa0tBQWtLLEtBQUssQ0FBQyxHQUFHO0FBQzlNLFVBQU0sSUFBSSxNQUFNLEtBQUssQ0FBQztBQUFBLEVBQ3hCO0FBRUEsYUFBVyxTQUFTLFdBQVcsTUFBTSxxQ0FBcUMsS0FBSyxDQUFDLEdBQUc7QUFDakYsVUFBTSxJQUFJLE1BQU0sS0FBSyxDQUFDO0FBQUEsRUFDeEI7QUFFQSxTQUFPLE1BQU0sS0FBSyxLQUFLLEVBQUUsTUFBTSxHQUFHLEVBQUU7QUFDdEM7IiwKICAibmFtZXMiOiBbXQp9Cg==
