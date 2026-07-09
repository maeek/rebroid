export interface AiProviderHttpCredentials {
  apiKey?: string | null;
}

export interface ProviderRequestScopeOptions {
  timeoutMs?: number;
  deadline?: number;
  abortSignal?: AbortSignal;
}

export const providerRequestHeaders = (
  provider: AiProviderHttpCredentials,
  options: { json?: boolean; headers?: HeadersInit } = {},
) => {
  const headers = new Headers(options.headers);
  if (options.json) headers.set("content-type", "application/json");
  if (provider.apiKey)
    headers.set("authorization", `Bearer ${provider.apiKey}`);
  return Object.fromEntries(headers.entries());
};

export const createProviderRequestScope = ({
  timeoutMs,
  deadline,
  abortSignal,
}: ProviderRequestScopeOptions) => {
  const controller = new AbortController();
  const remainingMs =
    deadline === undefined ? timeoutMs : deadline - Date.now();
  const boundedTimeout = Math.max(1, remainingMs ?? 60_000);
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, boundedTimeout);
  const abort = () => controller.abort();
  abortSignal?.addEventListener("abort", abort, { once: true });

  return {
    signal: controller.signal,
    wasCanceled: () => Boolean(abortSignal?.aborted),
    wasTimedOut: () => timedOut,
    cleanup: () => {
      clearTimeout(timeout);
      abortSignal?.removeEventListener("abort", abort);
    },
  };
};

export const readBoundedProviderText = async (
  response: Response,
  maxCharacters = 2_000,
) => (await response.text().catch(() => "")).slice(0, maxCharacters);

export const isProviderAbortError = (error: unknown) =>
  error instanceof Error &&
  (error.name === "AbortError" || error.name === "TimeoutError");
