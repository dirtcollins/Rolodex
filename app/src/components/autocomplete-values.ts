/** Free text remains valid; these helpers only describe suggestions and the token being completed. */
export function tokenRange(value: string, caret: number, commaSeparated: boolean) {
  if (!commaSeparated) return { start: 0, end: value.length };
  const point = Math.max(0, Math.min(caret, value.length));
  const start = point === 0 ? 0 : value.lastIndexOf(",", point - 1) + 1;
  const comma = value.indexOf(",", point);
  return { start, end: comma < 0 ? value.length : comma };
}

export function autocompleteSuggestions(options: string[], value: string, caret: number, commaSeparated: boolean) {
  const range = tokenRange(value, caret, commaSeparated);
  const needle = value.slice(range.start, range.end).trim().toLocaleLowerCase();
  const otherTokens = commaSeparated ? (value.slice(0, range.start) + value.slice(range.end)).split(",").map(token => token.trim().toLocaleLowerCase()).filter(Boolean) : [];
  const seen = new Set<string>(otherTokens);
  return options.filter(option => {
    const normalized = option.trim().toLocaleLowerCase();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return normalized.includes(needle);
  });
}

export function completeSuggestion(value: string, caret: number, suggestion: string, commaSeparated: boolean) {
  const range = tokenRange(value, caret, commaSeparated);
  const replacement = (commaSeparated && range.start > 0 ? " " : "") + suggestion;
  return { value: value.slice(0, range.start) + replacement + value.slice(range.end), caret: range.start + replacement.length };
}

export function autocompleteKey(key: string, active: number, count: number, open: boolean) {
  if (key === "ArrowDown" || key === "ArrowUp") {
    const previous = open ? active : -1;
    const index = !count ? -1 : key === "ArrowDown" ? (previous + 1) % count : previous <= 0 ? count - 1 : previous - 1;
    return { kind: "move" as const, index };
  }
  if (key === "Enter" && open && active >= 0 && active < count) return { kind: "choose" as const, index: active };
  if (key === "Escape" && open) return { kind: "close" as const, prevent: true };
  if (key === "Tab") return { kind: "close" as const, prevent: false };
  return null;
}
