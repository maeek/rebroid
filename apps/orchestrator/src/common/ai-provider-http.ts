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

export const createProviderRequestScope = ({
  timeoutMs,
  deadline,
  abortSignal,
}: ProviderRequestScopeOptions) => {
  const controller = new AbortController();
  const remainingMs = deadline === undefined ? Infinity : deadline - Date.now();
  const boundedTimeout = Math.max(
    0,
    Math.min(
      remainingMs,
      timeoutMs ?? (deadline === undefined ? 60_000 : Infinity),
    ),
  );
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, boundedTimeout);
  const abort = () => controller.abort();
  if (abortSignal?.aborted) abort();
  else abortSignal?.addEventListener('abort', abort, { once: true });

  return {
    signal: controller.signal,
    wasCanceled: () => Boolean(abortSignal?.aborted),
    wasTimedOut: () => timedOut,
    cleanup: () => {
      clearTimeout(timeout);
      abortSignal?.removeEventListener('abort', abort);
    },
  };
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
  const scope = createProviderRequestScope(options);
  try {
    scope.signal.throwIfAborted();
    if (options.deadline !== undefined && options.deadline <= Date.now()) {
      throw new ProviderRequestAbort('timeout');
    }
    const response = await fetch(url, { ...init, signal: scope.signal });
    const result = await consume(response);
    scope.signal.throwIfAborted();
    return result;
  } catch (error) {
    if (scope.wasCanceled()) throw new ProviderRequestAbort('canceled', error);
    if (
      scope.wasTimedOut() ||
      (isProviderAbortError(error) && !(error instanceof ProviderRequestAbort))
    ) {
      throw new ProviderRequestAbort('timeout', error);
    }
    throw error;
  } finally {
    scope.cleanup();
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
      text += decoder.decode(chunk.value, { stream: true });
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
