export const SCREEN_MUTATING_TOOLS = new Set([
  'android.adbShell',
  'android.inputText',
  'android.key',
  'android.rotateDisplay',
  'android.setClipboard',
  'android.swipe',
  'android.swipeNormalized',
  'android.tap',
  'android.tapNormalized',
  'android.viewerCommand',
]);

const UI_XML_MAX_CHARS = 80_000;
const PROVIDER_ERROR_MAX_CHARS = 500;
const EVENT_STRING_MAX_CHARS = 4_000;
const MODEL_TOOL_STRING_MAX_CHARS = 12_000;
const SANITIZE_MAX_DEPTH = 4;
const REDACTED_BINARY = '[redacted binary data]';

const sensitiveDataKeys = new Set([
  'apiKey',
  'apikey',
  'authorization',
  'base64',
  'contentBase64',
  'contentbase64',
  'dataUrl',
  'dataurl',
  'image',
  'imageUrl',
  'imageurl',
  'password',
  'secret',
  'token',
]);

export interface PreparedUiXml {
  xml: string;
  nodeCount: number;
  truncated: boolean;
}

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
) => {
  const text = typeof value === 'string' ? value : String(value ?? '');
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}... [truncated ${text.length - maxLength} chars]`;
};

export const sanitizeAiDataForEvent = (value: unknown) =>
  sanitizeAiData(value, EVENT_STRING_MAX_CHARS);

export const sanitizeAiDataForModel = (value: unknown) =>
  sanitizeAiData(value, MODEL_TOOL_STRING_MAX_CHARS);

export const providerErrorDetailFromText = (text: string) => {
  if (!text.trim()) return '';
  const detail = providerErrorTextFromBody(text);
  return sanitizeAiText(redactSecrets(detail), PROVIDER_ERROR_MAX_CHARS);
};

export const isImageInputUnsupportedProviderMessage = (message: string) => {
  const normalized = message.toLowerCase();
  return (
    (normalized.includes('image') ||
      normalized.includes('vision') ||
      normalized.includes('multimodal') ||
      normalized.includes('media')) &&
    (normalized.includes('not support') ||
      normalized.includes('unsupported') ||
      normalized.includes('invalid') ||
      normalized.includes('bad request'))
  );
};

const sanitizeAiData = (
  value: unknown,
  maxStringLength: number,
  depth = 0,
): unknown => {
  if (typeof value === 'string') return sanitizeAiText(value, maxStringLength);
  if (
    value === null ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (value === undefined) return null;
  if (depth >= SANITIZE_MAX_DEPTH) return '[truncated object]';
  if (Array.isArray(value)) {
    return value
      .slice(0, 50)
      .map((item) => sanitizeAiData(item, maxStringLength, depth + 1));
  }
  if (typeof value !== 'object') return sanitizeAiText(value, maxStringLength);

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (shouldRedactKey(key)) {
      output[key] = REDACTED_BINARY;
      continue;
    }
    output[key] = sanitizeAiData(item, maxStringLength, depth + 1);
  }
  return output;
};

const shouldRedactKey = (key: string) => {
  const normalized = key.toLowerCase();
  return (
    sensitiveDataKeys.has(key) ||
    sensitiveDataKeys.has(normalized) ||
    normalized.endsWith('base64') ||
    normalized.endsWith('dataurl')
  );
};

const providerErrorTextFromBody = (text: string) => {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (parsed && typeof parsed === 'object') {
      const record = parsed as Record<string, unknown>;
      const error = record.error;
      if (typeof error === 'string') return error;
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

const redactSecrets = (text: string) =>
  text
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, 'sk-[redacted]');
