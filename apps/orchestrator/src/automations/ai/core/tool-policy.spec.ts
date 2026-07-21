import { strict as assert } from 'node:assert';
import {
  applyRunVisionDefaults,
  blockedToolResult,
  classifyAssistantResponseContent,
  classifyToolFailure,
  classifyToolOutcome,
  parseToolCallArguments,
  preflightToolCall,
  repeatedToolAttemptGuard,
  shouldObserveAfterTool,
  toolAttemptKey,
  toolDisplayLabel,
} from './tool-policy';

describe('automation AI tool policy', () => {
  it('classifies no-tool public plans as continuations before the guardrail limit', () => {
    assert.deepEqual(
      classifyAssistantResponseContent({
        content: 'Current screen: Home\nGoal: Inspect packages',
        toolCallCount: 0,
        executedToolCalls: 0,
        noToolPlanContinuations: 0,
        maxNoToolPlanContinuations: 3,
      }),
      {
        action: 'continue-plan',
        normalizedText:
          '- **Current screen:** Home\n- **Goal:** Inspect packages',
        nextNoToolPlanContinuations: 1,
      },
    );
  });

  it('classifies repeated no-tool public plans as a guardrail', () => {
    assert.deepEqual(
      classifyAssistantResponseContent({
        content: 'Current screen: Home\nGoal: Inspect packages',
        toolCallCount: 0,
        executedToolCalls: 1,
        noToolPlanContinuations: 3,
        maxNoToolPlanContinuations: 3,
      }),
      {
        action: 'guardrail',
        normalizedText:
          '- **Current screen:** Home\n- **Goal:** Inspect packages',
        nextNoToolPlanContinuations: 3,
      },
    );
  });

  it('classifies no-tool non-plan content as final text', () => {
    assert.deepEqual(
      classifyAssistantResponseContent({
        content: 'Package list was inspected.',
        toolCallCount: 0,
        executedToolCalls: 1,
        noToolPlanContinuations: 1,
        maxNoToolPlanContinuations: 3,
      }),
      {
        action: 'final',
        normalizedText: 'Package list was inspected.',
        nextNoToolPlanContinuations: 1,
      },
    );
  });

  it('classifies tool-bearing content as progress and resets plan continuation count', () => {
    assert.deepEqual(
      classifyAssistantResponseContent({
        content: 'Next action: list packages',
        toolCallCount: 1,
        executedToolCalls: 0,
        noToolPlanContinuations: 2,
        maxNoToolPlanContinuations: 3,
      }),
      {
        action: 'continue-plan',
        normalizedText: 'Next action: list packages',
        nextNoToolPlanContinuations: 0,
      },
    );
  });

  it('classifies a no-tool attempted blocker as recoverable before any tool runs', () => {
    assert.deepEqual(
      classifyAssistantResponseContent({
        content: [
          'Current screen: Home screen',
          'Goal: Turn on dark mode theme',
          'Attempted: Opened Settings app.',
          'Remaining: No further tool actions possible.',
        ].join('\n'),
        toolCallCount: 0,
        executedToolCalls: 0,
        noToolPlanContinuations: 0,
        maxNoToolPlanContinuations: 3,
      }),
      {
        action: 'recover-no-tool',
        normalizedText: [
          '- **Current screen:** Home screen',
          '- **Goal:** Turn on dark mode theme',
          '- **Attempted:** Opened Settings app.',
          '- **Remaining:** No further tool actions possible.',
        ].join('\n'),
        nextNoToolPlanContinuations: 1,
      },
    );
  });

  it('applies tool policy for observation, compatible arguments, vision defaults, and shell blocking', () => {
    assert.equal(
      shouldObserveAfterTool({
        uses: 'android.adbShell',
        toolCall: {
          intent: 'Inspect',
          expectedOutcome: 'Read package output',
          input: { command: 'pm list packages' },
          requiresScreenObservation: false,
          envelopeValid: true,
        },
      }),
      false,
    );
    assert.equal(
      shouldObserveAfterTool({
        uses: 'android.tap',
        toolCall: {
          intent: 'Tap',
          expectedOutcome: 'Open target',
          input: { x: 0.5, y: 0.5 },
          envelopeValid: true,
        },
      }),
      true,
    );
    assert.equal(
      shouldObserveAfterTool({
        uses: 'android.expandQuickSettings',
        toolCall: {
          intent: 'Open quick settings',
          expectedOutcome: 'Quick settings panel is visible',
          input: {},
          envelopeValid: true,
        },
      }),
      true,
    );

    const compatible = parseToolCallArguments('vision.locate', {
      query: 'Downloads',
      maxResults: 3,
    });
    assert.equal(compatible.envelopeValid, false);
    assert.equal(compatible.intent, 'Locate visible screen target');
    assert.deepEqual(compatible.input, { query: 'Downloads', maxResults: 3 });
    assert.equal(
      toolDisplayLabel('android.tapNormalized'),
      'Tap screen coordinate',
    );

    assert.deepEqual(
      applyRunVisionDefaults(
        'vision.locate',
        {
          intent: 'Find downloads',
          expectedOutcome: 'Downloads text is located',
          input: { query: 'Downloads' },
          envelopeValid: false,
        },
        { visionProviderId: 'vision-provider', visionModelId: 'vision-model' },
      ).input,
      {
        query: 'Downloads',
        visionProviderId: 'vision-provider',
        visionModelId: 'vision-model',
      },
    );

    assert.equal(
      blockedToolResult('android.adbShell', {
        intent: 'Install app',
        expectedOutcome: 'App is installed',
        input: { command: 'pm install /sdcard/app.apk' },
        envelopeValid: true,
      })?.error,
      'Potentially destructive adbShell command blocked during AI automation.',
    );
  });

  it('blocks text tools when UI hierarchy is unavailable', () => {
    assert.deepEqual(
      preflightToolCall({
        uses: 'android.tapText',
        observation: {
          uiStatus: 'empty',
          uiNodes: 0,
          detections: 0,
        },
      }),
      {
        blocked: true,
        category: 'no_match',
        summary:
          'UI text lookup is unavailable because the latest UI hierarchy is empty or failed.',
        recoveryHint:
          'Use vision/location, normalized coordinates for visible targets, package/state discovery, or ask the user instead of retrying text lookup.',
      },
    );
    assert.equal(
      preflightToolCall({
        uses: 'android.tapText',
        observation: { uiStatus: 'available', uiNodes: 3 },
      }),
      null,
    );
  });

  it('blocks quick controls from app drawer for app/settings goals', () => {
    const guard = preflightToolCall({
      uses: 'android.expandQuickSettings',
      prompt: 'Open Android system Settings',
      toolCall: {
        intent: 'Open quick settings',
        expectedOutcome: 'Quick settings visible',
        input: {},
        envelopeValid: true,
      },
      observation: {
        screenKind: 'app_drawer',
        uiStatus: 'available',
        uiNodes: 4,
      },
    });

    assert.equal(guard?.blocked, true);
    assert.match(guard?.summary ?? '', /app drawer/);
    assert.match(guard?.recoveryHint ?? '', /app-drawer route/);

    assert.equal(
      preflightToolCall({
        uses: 'android.expandQuickSettings',
        prompt: 'Open quick settings and turn off Bluetooth',
        toolCall: {
          intent: 'Open quick controls',
          expectedOutcome: 'Quick controls panel visible',
          input: {},
          envelopeValid: true,
        },
        observation: { screenKind: 'app_drawer' },
      }),
      null,
    );
  });

  it('classifies repeated failed tool attempts', () => {
    assert.equal(
      toolAttemptKey('vision.locate', { maxResults: 1, query: 'Settings' }),
      toolAttemptKey('vision.locate', { query: 'Settings', maxResults: 1 }),
    );
    assert.equal(repeatedToolAttemptGuard({ attempts: 0, threshold: 1 }), null);
    assert.deepEqual(repeatedToolAttemptGuard({ attempts: 1, threshold: 1 }), {
      blocked: true,
      category: 'failed',
      summary:
        'The same tool and arguments already failed on this screen. Repeating it is unlikely to help.',
      recoveryHint:
        'Choose a materially different route: a different tool, different target, navigation step, state-discovery command, or user clarification.',
    });
  });

  it('classifies shell help output as a syntax failure', () => {
    assert.deepEqual(
      classifyToolFailure({
        uses: 'android.adbShell',
        message: 'Shell command failed with exit code 255.',
        data: {
          stdout:
            'Activity manager (activity) commands:\n  help\n    Print this help text.',
          exitCode: 255,
        },
      }),
      {
        category: 'syntax_error',
        summary:
          'android.adbShell failed because Android returned command help instead of executing the request.',
        recoveryHint:
          'Use a typed tool when available, or revise the shell command syntax instead of repeating the same command.',
      },
    );
  });

  it('classifies unchanged screen state after mutating actions as no effect', () => {
    assert.deepEqual(
      classifyToolOutcome({
        uses: 'android.tapNormalized',
        before: {
          uiStatus: 'empty',
          uiNodes: 0,
          detections: 0,
          screenKind: 'home',
          visionSummary: 'Home screen with gallery icon',
        },
        after: {
          uiStatus: 'empty',
          uiNodes: 0,
          detections: 0,
          screenKind: 'home',
          visionSummary: 'Home screen with gallery icon',
        },
      }),
      {
        changed: false,
        category: 'no_effect',
        summary:
          'android.tapNormalized completed, but the observed screen state did not change.',
        recoveryHint:
          'Treat the action as unconfirmed. Do not repeat the same action; choose a different target, navigation route, typed tool, or ask the user.',
        basis: 'screen-state-signature',
      },
    );
  });

  it('does not call empty failed observations a no-effect outcome', () => {
    assert.deepEqual(
      classifyToolOutcome({
        uses: 'android.expandQuickSettings',
        before: {
          uiStatus: 'failed',
          uiNodes: 0,
          detections: 0,
        },
        after: {
          uiStatus: 'failed',
          uiNodes: 0,
          detections: 0,
        },
      }),
      {
        changed: null,
        basis: 'no-comparable-screen-state',
      },
    );
  });

  it('treats quick-settings visual controls as a changed outcome', () => {
    assert.deepEqual(
      classifyToolOutcome({
        uses: 'android.expandQuickSettings',
        before: {
          uiStatus: 'failed',
          uiNodes: 0,
          detections: 0,
          screenKind: 'home',
          visibleText: ['Gallery'],
        },
        after: {
          uiStatus: 'failed',
          uiNodes: 0,
          detections: 0,
          screenKind: 'quick_settings',
          settingsAccessVisible: true,
          visibleText: ['Internet', 'Bluetooth', 'Battery Saver'],
          controls: [
            {
              label: 'Settings access gear',
              role: 'icon',
              confidence: 0.8,
            },
          ],
        },
      }),
      {
        changed: true,
        basis: 'screen-state-signature',
      },
    );
  });
});
