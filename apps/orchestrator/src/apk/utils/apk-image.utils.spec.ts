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
    const png = Buffer.alloc(24);
    png[0] = 0x89;
    png.write('PNG', 1, 'ascii');
    png.writeUInt32BE(48, 16);
    png.writeUInt32BE(96, 20);

    expect(imageDimensions(png, 'image/png')).toEqual({
      width: 48,
      height: 96,
    });
  });

  it('returns null for unsupported content', () => {
    expect(
      imageDimensions(Buffer.from('not-an-image'), 'image/png'),
    ).toBeNull();
    expect(imageDimensions(Buffer.from('nope'), 'image/jpeg')).toBeNull();
  });

  it('rejects unsupported, undersized, and oversized icon candidates', () => {
    const smallPng = Buffer.alloc(24);
    smallPng[0] = 0x89;
    smallPng.write('PNG', 1, 'ascii');
    smallPng.writeUInt32BE(16, 16);
    smallPng.writeUInt32BE(16, 20);

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
