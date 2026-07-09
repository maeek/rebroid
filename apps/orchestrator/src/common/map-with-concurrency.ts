import pLimit from 'p-limit';

export const mapWithConcurrency = async <Input, Output>(
  values: readonly Input[],
  concurrency: number,
  mapper: (value: Input, index: number) => Promise<Output>,
) => {
  const limit = pLimit(Math.max(1, Math.trunc(concurrency)));
  return Promise.all(
    values.map((value, index) => limit(() => mapper(value, index))),
  );
};

export const mapSettledWithConcurrency = <Input, Output>(
  values: readonly Input[],
  concurrency: number,
  mapper: (value: Input, index: number) => Promise<Output>,
) =>
  mapWithConcurrency(values, concurrency, async (value, index) => {
    try {
      return {
        status: 'fulfilled',
        value: await mapper(value, index),
      } satisfies PromiseFulfilledResult<Output>;
    } catch (reason) {
      return {
        status: 'rejected',
        reason,
      } satisfies PromiseRejectedResult;
    }
  });
