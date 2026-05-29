import { imageDimensions, imageMimeType } from './apk-image.utils';

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
});
