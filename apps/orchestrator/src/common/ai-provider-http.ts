import {
  readBoundedResponseBody,
  ResponseBodyLimitError,
} from './bounded-response-body';

interface AiProviderHttpCredentials {
  apiKey?: string | null;
}

interface ProviderRequestScopeOptions {
  timeoutMs?: number;
  deadline?: number;
  abortSignal?: AbortSignal;
}

export const providerRequestHeaders = (
  provider: AiProviderHttpCredentials,
  options: { json?: boolean; headers?: HeadersInit } = {},
) => {
  const headers = new Headers(options.headers);
  if (options.json) headers.set('content-type', 'application/json');
  if (provider.apiKey)
    headers.set('authorization', `Bearer ${provider.apiKey}`);
  return Object.fromEntries(headers.entries());
};

export class ProviderRequestAbort extends Error {
  constructor(
    readonly kind: 'canceled' | 'timeout',
    cause?: unknown,
  ) {
    super(
      kind === 'timeout'
        ? 'Provider request timed out.'
        : 'Provider request was canceled.',
      { cause },
    );
    this.name = kind === 'timeout' ? 'TimeoutError' : 'AbortError';
  }
}

export async function withProviderResponse<T>(
  url: string,
  init: RequestInit,
  options: ProviderRequestScopeOptions,
  consume: (response: Response) => Promise<T>,
): Promise<T> {
  const { abortSignal, deadline, timeoutMs } = options;
  const timeout = new AbortController();
  const signal = abortSignal
    ? AbortSignal.any([abortSignal, timeout.signal])
    : timeout.signal;
  const remaining = deadline === undefined ? Infinity : deadline - Date.now();
  const delay = Math.min(
    remaining,
    timeoutMs ?? (deadline === undefined ? 60_000 : Infinity),
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    signal.throwIfAborted();
    if (delay <= 0) throw new ProviderRequestAbort('timeout');
    timer = setTimeout(() => timeout.abort(), delay);
    const response = await fetch(url, { ...init, signal });
    const result = await consume(response);
    signal.throwIfAborted();
    return result;
  } catch (error) {
    if (signal.aborted) {
      const timedOut =
        timeout.signal.aborted && signal.reason === timeout.signal.reason;
      throw new ProviderRequestAbort(timedOut ? 'timeout' : 'canceled', error);
    }
    if (isProviderAbortError(error) && !(error instanceof ProviderRequestAbort))
      throw new ProviderRequestAbort('timeout', error);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export class ProviderResponseLimitError extends Error {
  constructor(limit: string) {
    super(`Provider response exceeds the ${limit} limit.`);
    this.name = 'ProviderResponseLimitError';
  }
}

export const maximumProviderJsonBytes = 16 * 1024 * 1024;

export const readProviderJson = async (
  response: Response,
  { strict = false }: { strict?: boolean } = {},
): Promise<unknown> => {
  const body = await readBoundedResponseBody(
    response,
    maximumProviderJsonBytes,
  ).catch((error: unknown) => {
    if (error instanceof ResponseBodyLimitError)
      throw new ProviderResponseLimitError('JSON body size');
    throw error;
  });
  if (!body) {
    if (strict) throw new SyntaxError('Provider returned an empty JSON body.');
    return null;
  }
  try {
    return JSON.parse(body.text) as unknown;
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
  }
  if (strict) throw new SyntaxError('Provider returned malformed JSON.');
  return null;
};

export const readBoundedProviderText = async (
  response: Response,
  maxCharacters = 2_000,
) => {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let text = '';
  try {
    while (text.length < maxCharacters) {
      const chunk = await reader.read();
      if (chunk.done) return (text + decoder.decode()).slice(0, maxCharacters);
      // Allow four UTF-8 bytes per remaining character and a leading three-byte BOM.
      const maxBytes = 4 * (maxCharacters - text.length) + 3;
      text += decoder.decode(chunk.value.subarray(0, maxBytes), {
        stream: true,
      });
    }
    return text.slice(0, maxCharacters);
  } finally {
    void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
};

const isProviderAbortError = (error: unknown) =>
  error instanceof Error &&
  (error.name === 'AbortError' || error.name === 'TimeoutError');
