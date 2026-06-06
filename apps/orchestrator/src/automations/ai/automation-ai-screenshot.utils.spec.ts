import sharp from 'sharp';
import { optimizeAiScreenshot } from './automation-ai-screenshot.utils';

describe('optimizeAiScreenshot', () => {
  it('downscales screenshots and emits jpeg data URLs for AI prompts', async () => {
    const width = 1200;
    const height = 800;
    const pixels = Buffer.alloc(width * height * 3);
    for (let index = 0; index < pixels.length; index += 1) {
      pixels[index] = index % 251;
    }
    const source = await sharp(pixels, {
      raw: {
        width,
        height,
        channels: 3,
      },
    })
      .png()
      .toBuffer();

    const result = await optimizeAiScreenshot({
      dataUrl: `data:image/png;base64,${source.toString('base64')}`,
      mimeType: 'image/png',
      capturedAt: '2026-06-06T12:00:00.000Z',
    });

    expect(result.optimized).toBe(true);
    expect(result.mimeType).toBe('image/jpeg');
    expect(result.dataUrl.startsWith('data:image/jpeg;base64,')).toBe(true);
    expect(result.width).toBe(1200);
    expect(result.height).toBe(800);
    expect(result.originalBytes).toBe(source.length);
    expect(result.bytes).toBeGreaterThan(0);
    const outputMetadata = await sharp(
      Buffer.from(result.dataUrl.split(',')[1] ?? '', 'base64'),
    ).metadata();
    expect(Math.max(outputMetadata.width ?? 0, outputMetadata.height ?? 0)).toBe(
      720,
    );
  });

  it('keeps the original screenshot when the data URL cannot be decoded', async () => {
    const result = await optimizeAiScreenshot({
      dataUrl: 'not-a-data-url',
      mimeType: 'image/png',
      capturedAt: '2026-06-06T12:00:00.000Z',
    });

    expect(result.optimized).toBe(false);
    expect(result.dataUrl).toBe('not-a-data-url');
    expect(result.bytes).toBe(0);
  });
});
