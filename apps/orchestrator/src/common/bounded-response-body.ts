export class ResponseBodyLimitError extends Error {}

export async function readBoundedResponseBody(
  response: Response,
  maxBytes: number,
): Promise<{ text: string; bytes: number } | null> {
  const reader = response.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let text = '';
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        throw new ResponseBodyLimitError(
          'Response body exceeds its byte limit.',
        );
      }
      text += decoder.decode(value, { stream: true });
    }
    return { text: text + decoder.decode(), bytes };
  } finally {
    void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
