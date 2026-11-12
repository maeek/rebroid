import { addAbortListener } from 'node:events';

export async function waitForOperation<T>(
  operation: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  let listener: ReturnType<typeof addAbortListener> | undefined;
  const aborted = new Promise<never>((_, reject) => {
    listener = addAbortListener(signal, () => reject(signal.reason));
  });
  try {
    const result = await Promise.race([operation, aborted]);
    signal.throwIfAborted();
    return result;
  } finally {
    listener?.[Symbol.dispose]();
  }
}
