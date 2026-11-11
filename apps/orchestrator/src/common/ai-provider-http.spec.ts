import assert from 'node:assert/strict';
import {
  createProviderRequestScope,
  providerRequestHeaders,
  readBoundedProviderText,
  readProviderJson,
  withProviderResponse,
} from './ai-provider-http';

it('builds authenticated JSON provider headers', () => {
  assert.deepEqual(
    providerRequestHeaders({ apiKey: 'secret' }, { json: true }),
    {
      authorization: 'Bearer secret',
      'content-type': 'application/json',
    },
  );
});

it('propagates cancellation and bounds provider response text', async () => {
  const parent = new AbortController();
  const scope = createProviderRequestScope({
    abortSignal: parent.signal,
    timeoutMs: 10_000,
  });
  parent.abort();
  assert.equal(scope.signal.aborted, true);
  assert.equal(scope.wasCanceled(), true);
  scope.cleanup();

  const response = new Response('abcdef');
  assert.equal(await readBoundedProviderText(response, 3), 'abc');
});

it('enforces the timeout while reading a response body', async () => {
  jest.useFakeTimers();
  const fetch = jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (_url, init) => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          init?.signal?.addEventListener(
            'abort',
            () => controller.error(init.signal?.reason),
            { once: true },
          );
        },
      });
      return new Response(body);
    });
  try {
    const pending = withProviderResponse(
      'http://provider.test',
      {},
      { timeoutMs: 25 },
      readProviderJson,
    );
    const expected = expect(pending).rejects.toMatchObject({ kind: 'timeout' });
    await jest.advanceTimersByTimeAsync(25);
    await expected;
  } finally {
    fetch.mockRestore();
    jest.useRealTimers();
  }
});
