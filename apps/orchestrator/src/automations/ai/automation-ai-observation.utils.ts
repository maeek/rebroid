export interface PreparedUiXml {
  xml: string;
  nodeCount: number;
  truncated: boolean;
}

const UI_XML_MAX_CHARS = 80_000;
const PROVIDER_ERROR_MAX_CHARS = 500;
const EVENT_STRING_MAX_CHARS = 4_000;
export const prepareUiXml = (xml: string): PreparedUiXml => {
  const normalized = xml.trim();
  const truncated = normalized.length > UI_XML_MAX_CHARS;
  const visibleXml = truncated
    ? `${normalized.slice(0, UI_XML_MAX_CHARS)}\n<!-- truncated -->`
    : normalized;

  return {
    xml: visibleXml,
    nodeCount: (normalized.match(/<node\b/g) ?? []).length,
    truncated,
  };
};

export const sanitizeAiText = (
  value: unknown,
  maxLength = EVENT_STRING_MAX_CHARS,
): string => {
  const text = typeof value === 'string' ? value : String(value ?? '');
  if (text.length <= maxLength) return text;

  return `${text.slice(0, maxLength)}... [truncated ${text.length - maxLength} chars]`;
};

export const providerErrorDetailFromText = (text: string) => {
  if (!text.trim()) return '';
  const detail = providerErrorTextFromBody(text);
  return sanitizeAiText(redactAiSecrets(detail), PROVIDER_ERROR_MAX_CHARS);
};

const providerErrorTextFromBody = (text: string) => {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (parsed && typeof parsed === 'object') {
      const record = parsed as Record<string, unknown>;
      const error = record.error;
      if (typeof error === 'string') {
        return error;
      }
      if (error && typeof error === 'object') {
        const errorRecord = error as Record<string, unknown>;
        const message = errorRecord.message ?? errorRecord.error;
        if (typeof message === 'string') return message;
      }
      const message = record.message ?? record.detail;
      if (typeof message === 'string') return message;
    }
  } catch {
    return text;
  }
  return text;
};

export const redactAiSecrets = (text: string) =>
  text
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, 'sk-[redacted]');
