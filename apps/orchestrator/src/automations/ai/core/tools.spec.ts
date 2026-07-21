import { strict as assert } from 'node:assert';
import { parseArguments } from './arguments';
import {
  allowedToolMatcher,
  buildToolDefinitions,
  mapUsesByToolName,
  toolName,
} from './tools';

describe('automation AI tools', () => {
  it('maps automation command names to OpenAI-compatible tool names', () => {
    assert.equal(toolName('android.tap'), 'android__tap');
    assert.equal(
      mapUsesByToolName([{ uses: 'android.tap' }]).get('android__tap'),
      'android.tap',
    );
    assert.equal(
      mapUsesByToolName([{ uses: 'vision.locate' }]).get('vision_locate'),
      'vision.locate',
    );
    assert.equal(
      mapUsesByToolName([
        {
          uses: 'android.expandQuickSettings',
          aiTool: { name: 'android_openQuickControlsPanel' },
        },
      ]).get('android_openQuickControlsPanel'),
      'android.expandQuickSettings',
    );
  });

  it('filters tools by allowed automation uses', () => {
    const allowed = allowedToolMatcher(['android.tap']);
    assert.deepEqual(
      buildToolDefinitions(
        [
          {
            uses: 'android.tap',
            label: 'Tap',
            description: 'Tap screen',
            inputSchema: { type: 'object' },
          },
          {
            uses: 'ai.run',
            label: 'AI',
            description: 'Nested AI',
            inputSchema: {},
          },
        ],
        allowed,
      ).map((tool) => tool.function.name),
      ['android__tap'],
    );
  });

  it('does not interpret a missing allowlist as every tool', () => {
    assert.equal(allowedToolMatcher(undefined)('android.adbShell'), false);
    assert.deepEqual(
      buildToolDefinitions([], allowedToolMatcher(undefined)),
      [],
    );
  });

  it('uses AI-facing tool names and descriptions without changing uses IDs', () => {
    const [tool] = buildToolDefinitions(
      [
        {
          uses: 'android.expandQuickSettings',
          label: 'Expand quick settings',
          description: 'Opens quick settings.',
          inputSchema: { type: 'object' },
          aiTool: {
            name: 'android_openQuickControlsPanel',
            label: 'Open quick controls panel',
            description:
              'Opens status-shade quick controls, not the Settings app.',
          },
        },
      ],
      allowedToolMatcher(['android.expandQuickSettings']),
    );

    assert.equal(tool.function.name, 'android_openQuickControlsPanel');
    assert.match(tool.function.description, /status-shade quick controls/);
    assert.equal(
      mapUsesByToolName([
        {
          uses: 'android.expandQuickSettings',
          aiTool: { name: 'android_openQuickControlsPanel' },
        },
      ]).get(tool.function.name),
      'android.expandQuickSettings',
    );
  });

  it('wraps tool inputs into a typed execution envelope', () => {
    const [tool] = buildToolDefinitions(
      [
        {
          uses: 'android.tap',
          label: 'Tap',
          description: 'Tap screen',
          inputSchema: {
            type: 'object',
            properties: { x: { type: 'number' } },
          },
        },
      ],
      () => true,
    );
    assert.equal(tool.type, 'function');
    assert.equal(tool.function.name, 'android__tap');
    assert.deepEqual(tool.function.parameters.required, [
      'intent',
      'expectedOutcome',
      'input',
    ]);
    assert.equal(tool.function.parameters.properties?.intent.type, 'string');
    assert.equal(
      tool.function.parameters.properties?.expectedOutcome.type,
      'string',
    );
    assert.deepEqual(tool.function.parameters.properties?.input, {
      type: 'object',
      properties: { x: { type: 'number' } },
    });
  });

  it('parses tool arguments defensively', () => {
    assert.deepEqual(parseArguments('{"x":1}'), { x: 1 });
    assert.deepEqual(parseArguments('[]'), {});
    assert.deepEqual(parseArguments('bad'), {});
  });
});
