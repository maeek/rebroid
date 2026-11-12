import { verifyAutomationAiFinish } from './automation-ai-finish-verifier';

const state = (): Parameters<typeof verifyAutomationAiFinish>[1] => ({
  subgoals: [
    {
      id: 'open-settings',
      goal: 'Open Settings',
      successEvidence: 'Settings is visible.',
      status: 'pending',
    },
  ],
  evidence: [
    {
      id: 'snapshot:screen-1',
      kind: 'snapshot',
      summary: 'Settings is visible.',
      snapshotId: 'screen-1',
    },
  ],
});

const finish = (patch: Record<string, unknown> = {}) =>
  ({
    kind: 'finish',
    status: 'completed',
    finalText: 'Done.',
    evidenceIds: ['snapshot:screen-1'],
    completedSubgoalIds: ['open-settings'],
    ...patch,
  }) as never;

describe('verifyAutomationAiFinish', () => {
  it('rejects unknown evidence and unfinished planned subgoals', () => {
    expect(
      verifyAutomationAiFinish(
        finish({ evidenceIds: ['snapshot:unknown'] }),
        state(),
      ),
    ).toEqual(
      expect.objectContaining({
        ok: false,
        reason: expect.stringContaining('unknown evidence'),
      }),
    );
    expect(
      verifyAutomationAiFinish(finish({ completedSubgoalIds: [] }), state()),
    ).toEqual({
      ok: false,
      reason: 'Not all planned subgoals were completed.',
    });
  });

  it('requires observed evidence for successful completion', () => {
    expect(
      verifyAutomationAiFinish(finish({ evidenceIds: [] }), state()),
    ).toEqual({
      ok: false,
      reason: 'Completed status requires observed evidence.',
    });
  });

  it('marks verified subgoals complete', () => {
    expect(verifyAutomationAiFinish(finish(), state())).toEqual({
      ok: true,
      evidenceIds: ['snapshot:screen-1'],
      subgoals: [
        expect.objectContaining({ id: 'open-settings', status: 'completed' }),
      ],
    });
  });
});
