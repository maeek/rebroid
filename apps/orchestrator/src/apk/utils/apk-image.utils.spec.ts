import {
  imageDimensions,
  imageMimeType,
  launcherIconDataUrl,
  normalizeApkDisplayName,
} from './apk-image.utils';

describe('apk image utilities', () => {
  it('detects supported image mime types by extension', () => {
    expect(imageMimeType('icon.png')).toBe('image/png');
    expect(imageMimeType('icon.webp')).toBe('image/webp');
    expect(imageMimeType('icon.jpeg')).toBe('image/jpeg');
    expect(imageMimeType('icon.svg')).toBeNull();
  });

  it('reads PNG dimensions from the image header', () => {
    const png = Buffer.from(
      '89504e470d0a1a0a0000000d494844520000003000000060',
      'hex',
    );

    expect(imageDimensions(png, 'image/png')).toEqual({
      width: 48,
      height: 96,
    });
  });

  it.each([
    ['5249464622000000574542505650384c160000002f20000c00', 33, 49],
    ['52494646500000005745425056503820440000009003009d012a5d001700', 93, 23],
    ['524946467000000057454250565038580a000000100000001a00002a0000', 27, 43],
  ] as const)(
    'reads a WebP frame header and ignores unrelated RIFF forms',
    (hex, width, height) => {
      const header = Buffer.from(hex, 'hex');
      expect(imageDimensions(header, 'image/webp')).toEqual({ width, height });
      expect(
        imageDimensions(header.subarray(0, header.length - 1), 'image/webp'),
      ).toBeNull();
      header.write('WAVE', 8);
      expect(imageDimensions(header, 'image/webp')).toBeNull();
    },
  );

  it('returns null for unsupported content', () => {
    expect(
      imageDimensions(Buffer.from('not-an-image'), 'image/png'),
    ).toBeNull();
    expect(imageDimensions(Buffer.from('nope'), 'image/jpeg')).toBeNull();
  });

  it('rejects unsupported, undersized, and oversized icon candidates', () => {
    const smallPng = Buffer.from(
      '89504e470d0a1a0a0000000d494844520000001000000010',
      'hex',
    );

    expect(launcherIconDataUrl('icon.svg', smallPng, 10_000)).toBeNull();
    expect(launcherIconDataUrl('icon.png', smallPng, 100)).toBeNull();
    expect(
      launcherIconDataUrl('icon.png', Buffer.alloc(8 * 1024 * 1024 + 1), 100),
    ).toBeNull();
  });

  it('normalizes bounded display names', () => {
    expect(normalizeApkDisplayName('  Rebroid\n App  ')).toBe('Rebroid App');
    expect(normalizeApkDisplayName('  ')).toBeNull();
    expect(normalizeApkDisplayName('a'.repeat(130))).toHaveLength(120);
  });
});
