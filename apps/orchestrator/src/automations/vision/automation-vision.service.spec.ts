import { createDetection } from './vision-observation';
import { AutomationVisionFusionService } from './automation-vision-fusion.service';
import { AutomationVisionService } from './automation-vision.service';

describe('AutomationVisionService', () => {
  it('finds a matching OCR detection beyond the planner shortlist', async () => {
    const bounds = { left: 0.1, top: 0.1, width: 0.2, height: 0.2 };
    const detections = Array.from({ length: 31 }, (_, index) =>
      createDetection({
        id: `ocr-${index}`,
        label: index === 30 ? 'Network' : `Unrelated ${index}`,
        source: 'ocr',
        confidence: index === 30 ? 0.7 : 0.99,
        bounds,
      }),
    );
    const model = { locateSafe: jest.fn() };
    const service = new AutomationVisionService(
      {
        capture: jest
          .fn()
          .mockResolvedValue({ ui: { status: 'failed' }, ocr: { detections } }),
      } as never,
      new AutomationVisionFusionService(),
      model as never,
    );
    const result = await service.locate({} as never, {
      query: 'network',
      threshold: 0.5,
      maxResults: 1,
    });
    expect(result.matches.map((match) => match.id)).toEqual(['ocr-30']);
    expect(model.locateSafe).not.toHaveBeenCalled();
  });

  it('locates OCR candidates from the fused observation before VLM fallback', async () => {
    const observation = {
      snapshotId: 'screen-1',
      image: {
        width: 1080,
        height: 2340,
        capturedAt: '2026-07-10T00:00:00.000Z',
        mimeType: 'image/png',
        source: 'screenshot' as const,
      },
      detections: [],
      candidates: [
        {
          id: 'ocr-1',
          label: 'Network & internet',
          source: 'ocr' as const,
          confidence: 0.93,
          bounds: { left: 0.1, top: 0.2, width: 0.5, height: 0.08 },
        },
      ],
      markedScreenshotId: 'som-screen-1',
    };
    const model = { locateSafe: jest.fn() };
    const service = new AutomationVisionService(
      { capture: jest.fn().mockResolvedValue({}) } as never,
      {
        lookupDetections: jest.fn().mockReturnValue(observation.candidates),
      } as never,
      model as never,
    );

    const result = await service.locate(
      {} as never,
      { query: 'network', threshold: 0.5, maxResults: 3 },
      undefined,
    );

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({ id: 'ocr-1', source: 'ocr' });
    expect(model.locateSafe).not.toHaveBeenCalled();
  });
});
