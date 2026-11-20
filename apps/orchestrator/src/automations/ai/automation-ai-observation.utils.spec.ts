import {
  prepareUiXml,
  providerErrorDetailFromText,
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
});
