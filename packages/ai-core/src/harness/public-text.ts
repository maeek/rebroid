const fencedJsonPattern = /^```(?:json)?\s*([\s\S]*?)\s*```$/i;

export const normalizePublicAiText = (text: string, maxLength = 4_000) => {
  const trimmed = text.trim();
  if (!trimmed) return "";

  const parsed = parsePublicJsonText(trimmed);
  if (parsed !== null) {
    const markdown = publicJsonToMarkdown(parsed);
    if (markdown) return truncate(markdown, maxLength);
  }

  const lineMarkdown = jsonLinesToMarkdown(trimmed);
  if (lineMarkdown) return truncate(lineMarkdown, maxLength);

  return truncate(trimmed, maxLength);
};

const parsePublicJsonText = (text: string) => {
  const fenced = text.match(fencedJsonPattern);
  const candidate = fenced?.[1]?.trim() ?? text;
  if (!looksLikeJson(candidate)) return null;
  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    return null;
  }
};

const jsonLinesToMarkdown = (text: string) => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2 || !lines.every(looksLikeJson)) return "";

  const sections = lines.flatMap((line) => {
    const parsed = parsePublicJsonText(line);
    const markdown = parsed === null ? "" : publicJsonToMarkdown(parsed);
    return markdown ? [markdown] : [];
  });
  return sections.length === lines.length ? sections.join("\n\n") : "";
};

const looksLikeJson = (text: string) => {
  const trimmed = text.trim();
  return (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  );
};

const publicJsonToMarkdown = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => {
        const rendered = renderJsonValue(item);
        return rendered ? [`- ${rendered}`] : [];
      })
      .join("\n");
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .flatMap(([key, item]) => {
        const rendered = renderJsonValue(item);
        return rendered ? [`- **${humanizeKey(key)}:** ${rendered}`] : [];
      })
      .join("\n");
  }
  return "";
};

const renderJsonValue = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(renderJsonValue).filter(Boolean).join("; ");
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .flatMap(([key, item]) => {
        const rendered = renderJsonValue(item);
        return rendered ? [`${humanizeKey(key)}: ${rendered}`] : [];
      })
      .join("; ");
  }
  return "";
};

const humanizeKey = (key: string) =>
  key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());

const truncate = (value: string, maxLength: number) =>
  value.length > maxLength
    ? `${value.slice(0, Math.max(0, maxLength - 1))}…`
    : value;
