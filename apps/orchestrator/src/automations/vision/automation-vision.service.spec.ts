import { createDetection } from './vision-observation';
import { AutomationVisionFusionService } from './automation-vision-fusion.service';
import { AutomationVisionService } from './automation-vision.service';
import { VisionAutomationCommandsService } from '../commands/vision-automation-commands.service';
import { AutomationCommandRegistryService } from '../commands/automation-command-registry.service';
import { AutomationConditionService } from '../condition/automation-condition.service';
import { AutomationDefinitionNormalizerService } from '../definition/automation-definition-normalizer.service';

describe('AutomationVisionService', () => {
  it.each(['fresh capture', 'existing snapshot'])(
    'keeps matches from incomplete OCR and reports an inconclusive miss from a %s',
    async (source) => {
      const detection = createDetection({
        id: 'ocr-1',
        label: 'Settings',
        confidence: 0.9,
        bounds: { left: 0.1, top: 0.1, width: 0.2, height: 0.2 },
        source: 'ocr',
      });
      const ocr = {
        status: 'available',
        detections: [detection],
        searchComplete: false,
      };
      const service = new AutomationVisionService(
        { capture: async () => ({ ocr }) } as never,
        { lookupDetections: () => [detection] } as never,
        {} as never,
      );
      const context =
        source === 'existing snapshot'
          ? { visionSnapshot: { detections: [], ocr } }
          : {};

      await expect(
        service.locate(context as never, {
          query: 'Settings',
          threshold: 0.5,
          maxResults: 1,
        }),
      ).resolves.toMatchObject({ outcome: 'found', matches: [detection] });
      await expect(
        service.locate(context as never, {
          query: 'Network',
          threshold: 0.5,
          maxResults: 1,
        }),
      ).resolves.toMatchObject({ outcome: 'inconclusive', matches: [] });
    },
  );

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
        capture: jest.fn().mockResolvedValue({
          ui: { status: 'failed' },
          ocr: { status: 'available', detections },
        }),
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
      {
        capture: jest.fn().mockResolvedValue({ ocr: { status: 'available' } }),
      } as never,
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

  it('declares bounded OCR output and distinguishes an unavailable source in a workflow branch', async () => {
    const screenshot = {
      dataUrl: '',
      capturedAt: 'now',
      mimeType: 'image/png',
    };
    const detections = ['Z\u0307appka', 'Other'].map((text, index) =>
      createDetection({
        id: `ocr-${index}`,
        text,
        source: 'ocr',
        confidence: 0.9,
        bounds: { left: 0.1, top: 0.1, width: 0.2, height: 0.2 },
      }),
    );
    const capture = {
      screenshot,
      aiImage: { ...screenshot, width: 100, height: 100 },
      ui: { status: 'failed' },
      ocr: { status: 'available', detections },
    };
    const vision = new AutomationVisionService(
      { capture: async () => capture } as never,
      new AutomationVisionFusionService(),
      {} as never,
    );
    const registry = new AutomationCommandRegistryService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    registry.register(
      new VisionAutomationCommandsService({} as never, vision).list(),
    );
    const conditions = new AutomationConditionService();
    const definition = new AutomationDefinitionNormalizerService(
      registry,
      conditions,
    ).normalize({
      apiVersion: 'rebroid.io/automation/v1',
      kind: 'AndroidAutomation',
      metadata: { name: 'Check OCR' },
      spec: {
        steps: [
          { id: 'observe', uses: 'vision.observe', with: { maxDetections: 1 } },
          { id: 'search', uses: 'vision.locate', with: { query: 'Żappka' } },
          {
            id: 'check',
            type: 'condition',
            condition: {
              groups: [
                {
                  conditions: [
                    {
                      value: {
                        source: 'stepOutput',
                        stepId: 'observe',
                        outputKey: 'ocrStatus',
                      },
                      operator: 'equals',
                      compare: { source: 'literal', value: 'available' },
                    },
                    {
                      value: {
                        source: 'stepOutput',
                        stepId: 'search',
                        outputKey: 'outcome',
                      },
                      operator: 'equals',
                      compare: { source: 'literal', value: 'not_found' },
                    },
                  ],
                },
              ],
            },
            then: [{ id: 'confirmed-miss', uses: 'vision.observe', with: {} }],
          },
        ],
      },
    });
    const observed = await registry.execute(
      'vision.observe',
      { maxDetections: 1 },
      {} as never,
    );
    expect(observed.data).toMatchObject({
      detections: [],
      ocrStatus: 'available',
      ocrTextCount: 2,
      ocrDetections: [expect.objectContaining({ source: 'ocr' })],
      ocr: { detections: [expect.any(Object)] },
    });
    expect(
      registry.outputsFor('vision.observe').map((output) => output.key),
    ).toContain('ocrDetections');
    const matched = await registry.execute(
      'vision.locate',
      { query: 'Żappka' },
      {} as never,
    );
    expect(matched.data).toMatchObject({
      found: true,
      outcome: 'found',
      matches: [{ source: 'ocr' }],
    });

    const branch = definition.spec.steps[2];
    if (!('type' in branch) || branch.type !== 'condition')
      throw new Error('Expected a condition.');
    for (const [status, outcome] of [
      ['available', 'not_found'],
      ['failed', 'inconclusive'],
      ['disabled', 'inconclusive'],
    ]) {
      capture.ocr = { status, detections: [] };
      const result = await registry.execute(
        'vision.locate',
        { query: 'Żappka' },
        {} as never,
      );
      expect(result.data).toMatchObject({
        found: false,
        outcome,
        ocrStatus: status,
      });
      expect(
        conditions.evaluate(branch.condition, {
          runId: 'run',
          trigger: 'manual',
          targetProfileMode: null,
          targetProfileName: null,
          app: {},
          outputsByStepId: new Map([
            ['observe', observed.data!],
            ['search', result.data!],
          ]),
        }),
      ).toBe(status === 'available');
    }
  });
});
