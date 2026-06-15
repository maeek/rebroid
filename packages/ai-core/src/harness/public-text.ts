const fencedJsonPattern = /^```(?:json)?\s*([\s\S]*?)\s*```$/i;
const publicPlanLabels = new Map([
  ["current screen", "Current screen"],
  ["goal", "Goal"],
  ["next move", "Next move"],
  ["next moves", "Next moves"],
  ["first action", "First action"],
  ["first action attempted", "First action attempted"],
  ["attempted", "Attempted"],
  ["result", "Result"],
  ["reason", "Reason"],
  ["remaining", "Remaining"],
  ["blocked", "Blocked"],
  ["blocker", "Blocker"],
  ["replan", "Replan"],
  ["replan if", "Replan if"],
]);

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

  const planMarkdown = publicPlanLinesToMarkdown(trimmed);
  if (planMarkdown) return truncate(planMarkdown, maxLength);

  return truncate(trimmed, maxLength);
};

export const isPublicPlanText = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (parsePublicJsonText(trimmed) !== null) return true;
  if (jsonLinesToMarkdown(trimmed)) return true;
  return Boolean(publicPlanLinesToMarkdown(trimmed));
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

const publicPlanLinesToMarkdown = (text: string) => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return "";

  let recognized = 0;
  const rendered = lines.map((line) => {
    const parsed = parsePlanLine(line);
    if (!parsed) return line;
    recognized += 1;
    return `- **${parsed.label}:** ${parsed.value}`;
  });

  if (recognized < 2) return "";
  return rendered.join("\n");
};

const parsePlanLine = (line: string) => {
  const candidate = line.replace(/^[-*]\s+/, "").trim();
  const boldMatch =
    candidate.match(/^\*\*([^*:\n]{2,48})\*\*:\s*(.+)$/) ??
    candidate.match(/^\*\*([^*:\n]{2,48}):\*\*\s*(.+)$/);
  const plainMatch = candidate.match(/^([A-Za-z][A-Za-z /_-]{1,48}):\s*(.+)$/);
  const label = (boldMatch?.[1] ?? plainMatch?.[1] ?? "").trim();
  const value = (boldMatch?.[2] ?? plainMatch?.[2] ?? "").trim();
  if (!label || !value) return null;

  const normalizedLabel = publicPlanLabels.get(normalizeLabel(label));
  if (!normalizedLabel) return null;
  return { label: normalizedLabel, value };
};

const normalizeLabel = (label: string) =>
  label.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase();

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
