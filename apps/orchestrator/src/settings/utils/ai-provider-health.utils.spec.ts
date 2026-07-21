import {
  aiProviderErrorMessage,
  isProviderTimeoutError,
  modelRoleProbeIncompatibility,
} from './ai-provider-health.utils';

describe('AI provider health parsing', () => {
  it('accepts the required controller tool call', () => {
    expect(
      modelRoleProbeIncompatibility('controller', {
        choices: [
          {
            message: {
              tool_calls: [
                { function: { name: 'health_check_noop', arguments: '{}' } },
              ],
            },
          },
        ],
      }),
    ).toBeNull();
  });

  it.each([
    ['planner', {}, 'no assistant message'],
    [
      'planner',
      { choices: [{ message: { reasoning_content: 'thinking' } }] },
      'reasoning but no public content',
    ],
    [
      'vision',
      { choices: [{ message: { content: 'black' } }] },
      'did not identify',
    ],
  ] as const)('classifies incompatible %s responses', (role, body, message) => {
    expect(modelRoleProbeIncompatibility(role, body)).toContain(message);
  });

  it('classifies timeout-shaped errors', () => {
    const error = new Error('request aborted due to timeout');
    expect(isProviderTimeoutError(error)).toBe(true);
  });

  it('deduplicates useful network cause details', () => {
    const error = new Error('fetch failed', {
      cause: {
        message: 'connection refused',
        code: 'ECONNREFUSED',
        address: '127.0.0.1',
        port: 11434,
      },
    });
    expect(aiProviderErrorMessage(error)).toBe(
      'fetch failed: connection refused ECONNREFUSED 127.0.0.1 11434',
    );
  });
});
