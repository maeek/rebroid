import sharp from 'sharp';
import {
  createMarkedAiScreenshot,
  optimizeAiScreenshot,
} from './automation-ai-screenshot.utils';

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
    expect(result.renderedWidth).toBe(720);
    expect(result.renderedHeight).toBe(480);
    expect(result.originalBytes).toBe(source.length);
    expect(result.bytes).toBeGreaterThan(0);
    const outputMetadata = await sharp(
      Buffer.from(result.dataUrl.split(',')[1] ?? '', 'base64'),
    ).metadata();
    expect(
      Math.max(outputMetadata.width ?? 0, outputMetadata.height ?? 0),
    ).toBe(720);
  });

  it('renders set-of-marks labels onto the optimized screenshot', async () => {
    const source = await sharp({
      create: {
        width: 400,
        height: 800,
        channels: 3,
        background: '#ffffff',
      },
    })
      .png()
      .toBuffer();
    const optimized = await optimizeAiScreenshot({
      dataUrl: `data:image/png;base64,${source.toString('base64')}`,
      mimeType: 'image/png',
      capturedAt: '2026-06-06T12:00:00.000Z',
    });

    const marked = await createMarkedAiScreenshot(optimized, [
      {
        id: 'ocr-1',
        bounds: { left: 0.1, top: 0.2, width: 0.4, height: 0.1 },
      },
    ]);

    expect(marked.dataUrl).not.toBe(optimized.dataUrl);
    expect(marked.renderedWidth).toBe(360);
    expect(marked.renderedHeight).toBe(720);
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
