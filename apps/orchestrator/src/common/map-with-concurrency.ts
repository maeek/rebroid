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
