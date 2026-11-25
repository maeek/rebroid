import { AsyncLocalStorage } from "node:async_hooks";
import type { ServerResponse } from "node:http";

export const attachmentRequestSignal = new AsyncLocalStorage<AbortSignal>();

export async function runAttachmentRequest<T>(
  response: ServerResponse,
  lease: AbortSignal,
  operation: (signal: AbortSignal) => Promise<T>,
) {
  const abandoned = new AbortController();
  const close = () => abandoned.abort();
  response.once("close", close);
  if (response.destroyed) close();
  const signal = AbortSignal.any([
    lease,
    abandoned.signal,
    AbortSignal.timeout(7_500),
  ]);
  try {
    signal.throwIfAborted();
    const result = await attachmentRequestSignal.run(signal, () =>
      operation(signal),
    );
    signal.throwIfAborted();
    return result;
  } finally {
    response.off("close", close);
  }
}
