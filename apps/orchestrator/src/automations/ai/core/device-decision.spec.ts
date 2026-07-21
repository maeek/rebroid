import { strict as assert } from 'node:assert';
import {
  DEVICE_DECISION_TOOL_NAME,
  parseDeviceAgentDecision,
} from './device-decision';

describe('automation AI device decisions', () => {
  it('parses the single structured device decision tool', () => {
    assert.deepEqual(
      parseDeviceAgentDecision({
        content: '',
        toolCalls: [
          {
            id: 'decision',
            type: 'function',
            function: {
              name: DEVICE_DECISION_TOOL_NAME,
              arguments: JSON.stringify({
                kind: 'act',
                snapshotId: 'screen-1',
                intent: 'Open Settings',
                expectedOutcome: 'Settings screen appears',
                action: { type: 'tap', candidateId: 'ocr-1' },
              }),
            },
          },
        ],
      }),
      {
        kind: 'act',
        snapshotId: 'screen-1',
        intent: 'Open Settings',
        expectedOutcome: 'Settings screen appears',
        action: { type: 'tap', candidateId: 'ocr-1' },
      },
    );
  });

  it('normalizes a Gemma-style wrapped action against the current snapshot', () => {
    assert.deepEqual(
      parseDeviceAgentDecision({
        content: `<tool_call>{"name":"${DEVICE_DECISION_TOOL_NAME}","arguments":{"action":{"type":"tap","candidate_id":"candidate-1"},"reason":"Open Gallery"}}</tool_call>`,
        defaultSnapshotId: 'screen-2',
      }),
      {
        kind: 'act',
        snapshotId: 'screen-2',
        intent: 'Open Gallery',
        expectedOutcome: 'Open Gallery',
        action: { type: 'tap', candidateId: 'candidate-1' },
      },
    );
  });

  it('normalizes direct coordinate actions and snake-case fields', () => {
    assert.deepEqual(
      parseDeviceAgentDecision({
        content: JSON.stringify({
          decision: {
            type: 'tap',
            x: 0.5,
            y: 0.625,
            expected_outcome: 'Gallery opens',
          },
        }),
        defaultSnapshotId: 'screen-3',
      }),
      {
        kind: 'act',
        snapshotId: 'screen-3',
        intent: 'Perform tap',
        expectedOutcome: 'Gallery opens',
        action: { type: 'tap', point: { x: 0.5, y: 0.625 } },
      },
    );
  });

  it('normalizes local-model action names and parameter envelopes', () => {
    assert.deepEqual(
      parseDeviceAgentDecision({
        content: JSON.stringify({
          action: 'click',
          parameters: { coordinates: { x: 0.4, y: 0.7 } },
        }),
        defaultSnapshotId: 'screen-3',
      }),
      {
        kind: 'act',
        snapshotId: 'screen-3',
        intent: 'Perform tap',
        expectedOutcome: 'The requested device state changes visibly',
        action: { type: 'tap', point: { x: 0.4, y: 0.7 } },
      },
    );
  });

  it('treats a decision discriminator as the kind instead of an envelope', () => {
    assert.deepEqual(
      parseDeviceAgentDecision({
        content: JSON.stringify({
          decision: 'act',
          action: { type: 'tap', candidateId: 'candidate-2' },
        }),
        defaultSnapshotId: 'screen-3',
      }),
      {
        kind: 'act',
        snapshotId: 'screen-3',
        intent: 'Perform tap',
        expectedOutcome: 'The requested device state changes visibly',
        action: { type: 'tap', candidateId: 'candidate-2' },
      },
    );
  });

  it('normalizes a minimal blocked completion', () => {
    assert.deepEqual(
      parseDeviceAgentDecision({
        content: JSON.stringify({
          kind: 'finish',
          status: 'blocked',
          message: 'Cannot continue safely.',
        }),
      }),
      {
        kind: 'finish',
        status: 'blocked',
        finalText: 'Cannot continue safely.',
        evidenceIds: [],
        completedSubgoalIds: [],
      },
    );
  });

  it('continues to reject ungrounded tap descriptions', () => {
    assert.throws(
      () =>
        parseDeviceAgentDecision({
          content: JSON.stringify({
            action: { type: 'tap', target: 'Gallery' },
          }),
          defaultSnapshotId: 'screen-4',
        }),
      /ungrounded action/,
    );
  });
});
