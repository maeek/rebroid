import { strict as assert } from 'node:assert';
import {
  isImageInputUnsupportedProviderMessage,
  prepareUiXml,
  sanitizeAiDataForModel,
  sanitizeAiDataForToolOutput,
  providerErrorDetailFromText,
  sanitizeAiDataForEvent,
  isDangerousAdbShellCommand,
} from './automation-ai-observation.utils';

describe('ai observation utilities', () => {
  it('bounds UI XML and records node metadata', () => {
    const xml = `<hierarchy>${'<node text="item" />'.repeat(5000)}</hierarchy>`;
    const prepared = prepareUiXml(xml);

    assert.equal(prepared.nodeCount, 5000);
    assert.equal(prepared.truncated, true);
    assert.ok(prepared.xml.length < xml.length);
    assert.ok(prepared.xml.includes('<!-- truncated -->'));
  });

  it('redacts binary and secret-like data from event payloads', () => {
    assert.deepEqual(
      sanitizeAiDataForEvent({
        dataUrl: 'data:image/png;base64,abc',
        contentBase64: 'abc',
        token: 'secret-token',
        output: 'ok',
      }),
      {
        dataUrl: '[redacted binary data]',
        contentBase64: '[redacted binary data]',
        token: '[redacted binary data]',
        output: 'ok',
      },
    );
  });

  it('extracts bounded provider errors without bearer tokens', () => {
    const detail = providerErrorDetailFromText(
      JSON.stringify({
        error: {
          message:
            'Bad request with Bearer abcdefghijklmnopqrstuvwxyz and model does not support tools',
        },
      }),
    );

    assert.ok(detail.includes('Bearer [redacted]'));
    assert.ok(detail.includes('does not support tools'));
    assert.ok(!detail.includes('abcdefghijklmnopqrstuvwxyz'));
  });

  it('detects image-input compatibility failures', () => {
    assert.equal(
      isImageInputUnsupportedProviderMessage(
        '400 Bad Request - model does not support images',
      ),
      true,
    );
    assert.equal(
      isImageInputUnsupportedProviderMessage('500 Internal Server Error'),
      false,
    );
  });

  it('redacts sensitive values deeply nested in model payloads', () => {
    const redacted = sanitizeAiDataForModel({
      payload: {
        metadata: {
          token: 'secret-token',
          nested: {
            dataUrl: 'data:image/png;base64,xxxx',
            children: [{ apikey: 'abcd' }, 'keep'],
          },
        },
      },
      output: {
        type: 'tool',
        contentBase64: 'abc',
      },
    });
    const sanitized = redacted as {
      payload: {
        metadata: {
          token: string;
          nested: { dataUrl: string; children: { [key: string]: unknown }[] };
        };
      };
      output: { contentBase64: string };
    };

    assert.equal(sanitized.payload.metadata.token, '[redacted binary data]');
    assert.equal(
      sanitized.payload.metadata.nested.dataUrl,
      '[redacted binary data]',
    );
    assert.equal(
      sanitized.payload.metadata.nested.children,
      '[truncated object]',
    );
    assert.equal(sanitized.output.contentBase64, '[redacted binary data]');
  });

  it('truncates long event text payloads', () => {
    assert.equal(
      String(sanitizeAiDataForEvent('x'.repeat(10_000))).length > 4_000,
      true,
    );
  });

  it('keeps long tool output text values less aggressively truncated', () => {
    assert.equal(
      sanitizeAiDataForToolOutput('x'.repeat(80_000)),
      'x'.repeat(80_000),
    );
    assert.equal(
      sanitizeAiDataForToolOutput('y'.repeat(120_000)),
      'y'.repeat(120_000),
    );
  });

  it('classifies destructive adb shell commands', () => {
    assert.equal(
      isDangerousAdbShellCommand('pm install /sdcard/app.apk'),
      true,
    );
    assert.equal(
      isDangerousAdbShellCommand('cmd package install-existing com.example'),
      true,
    );
    assert.equal(isDangerousAdbShellCommand('rm -rf /sdcard/Download'), true);
    assert.equal(isDangerousAdbShellCommand('su -c ls /'), true);
    assert.equal(isDangerousAdbShellCommand('reboot'), true);
  });

  it('allows non-destructive adb shell commands', () => {
    assert.equal(isDangerousAdbShellCommand('pm list packages'), false);
    assert.equal(
      isDangerousAdbShellCommand('settings get global hidden_api_policy'),
      false,
    );
    assert.equal(isDangerousAdbShellCommand('wm size'), false);
    assert.equal(isDangerousAdbShellCommand('ls /sdcard | head -20'), false);
  });

  it('returns false for empty or whitespace commands', () => {
    assert.equal(isDangerousAdbShellCommand(''), false);
    assert.equal(isDangerousAdbShellCommand('   '), false);
  });
});
