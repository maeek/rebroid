import assert from 'node:assert/strict';
import {
  createProviderRequestScope,
  providerRequestHeaders,
  readBoundedProviderText,
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
