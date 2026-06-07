import {
  isImageInputUnsupportedProviderMessage,
  prepareUiXml,
  providerErrorDetailFromText,
  sanitizeAiDataForEvent,
} from './automation-ai-observation.utils';

describe('automation AI observation utilities', () => {
  it('bounds UI XML and records node metadata', () => {
    const xml = `<hierarchy>${'<node text="item" />'.repeat(5000)}</hierarchy>`;
    const prepared = prepareUiXml(xml);

    expect(prepared.nodeCount).toBe(5000);
    expect(prepared.truncated).toBe(true);
    expect(prepared.xml.length).toBeLessThan(xml.length);
    expect(prepared.xml).toContain('<!-- truncated -->');
  });

  it('redacts binary and secret-like data from event payloads', () => {
    expect(
      sanitizeAiDataForEvent({
        dataUrl: 'data:image/png;base64,abc',
        contentBase64: 'abc',
        token: 'secret-token',
        output: 'ok',
      }),
    ).toEqual({
      dataUrl: '[redacted binary data]',
      contentBase64: '[redacted binary data]',
      token: '[redacted binary data]',
      output: 'ok',
    });
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

    expect(detail).toContain('Bearer [redacted]');
    expect(detail).toContain('does not support tools');
    expect(detail).not.toContain('abcdefghijklmnopqrstuvwxyz');
  });

  it('detects image-input compatibility failures', () => {
    expect(
      isImageInputUnsupportedProviderMessage(
        '400 Bad Request - model does not support images',
      ),
    ).toBe(true);
    expect(
      isImageInputUnsupportedProviderMessage('500 Internal Server Error'),
    ).toBe(false);
  });
});
