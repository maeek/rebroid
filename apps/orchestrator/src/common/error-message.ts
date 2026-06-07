const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const extractErrorMessage = (
  error: Record<string, unknown> | null,
  depth = 0,
): string | null => {
  if (!error || depth > 3) {
    return null;
  }

  const direct = [
    error.message,
    error.reason,
    error.detail,
    error.code,
    error.statusMessage,
    error.error,
  ];
  for (const candidate of direct) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  const jsonMessage = asRecord(error.json);
  if (jsonMessage) {
    const fromJson = extractErrorMessage(jsonMessage, depth + 1);
    if (fromJson) return fromJson;
  }

  const body = error.body;
  if (typeof body === 'string' && body.trim()) {
    try {
      const parsed = JSON.parse(body) as unknown;
      const fromParsed = extractErrorMessage(asRecord(parsed), depth + 1);
      if (fromParsed) return fromParsed;
    } catch {
      return body;
    }
  }

  const nested = asRecord(error.error);
  if (nested) {
    return extractErrorMessage(nested, depth + 1);
  }

  const cause = asRecord(error.cause);
  if (cause) {
    return extractErrorMessage(cause, depth + 1);
  }

  return null;
};

export const getErrorMessage = (error: unknown, fallback = 'Unknown error') => {
  if (error instanceof Error) {
    return error.message || fallback;
  }

  if (typeof error === 'string') {
    return error || fallback;
  }

  const record = asRecord(error);
  return extractErrorMessage(record) || fallback;
};
