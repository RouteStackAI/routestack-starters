const DATE_TOKEN =
  "(?:\\d{4}-\\d{2}-\\d{2}|[A-Za-z]{3,9}\\s+\\d{1,2}(?:,\\s*\\d{4})?)";

export const dateTokenPattern = DATE_TOKEN;

export function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}
