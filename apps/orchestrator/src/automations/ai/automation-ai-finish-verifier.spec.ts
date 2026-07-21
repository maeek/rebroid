import { verifyAutomationAiFinish } from './automation-ai-finish-verifier';
import type { DeviceAgentState } from './automation-device-agent-state';

const state = (): DeviceAgentState => ({
  target: {
    id: 'target-1',
    fingerprint: 'fingerprint-1',
    applicationId: 'app-1',
    containerId: 'container-1',
    containerName: 'runtime-1',
    networkName: 'network-1',
    adbPort: 5555,
  },
  observation: { snapshotId: 'screen-1' } as never,
  plannerText: '',
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
  trajectory: [],
  actions: 0,
  consecutiveFailures: 0,
  planAttempts: 1,
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
      subgoals: [
        expect.objectContaining({ id: 'open-settings', status: 'completed' }),
      ],
    });
  });
});
