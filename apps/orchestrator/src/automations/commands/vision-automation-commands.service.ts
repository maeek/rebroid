import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AutomationAiProviderService } from '../ai/automation-ai-provider.service';
import { AutomationVisionService } from '../vision/automation-vision.service';
import type {
  AutomationCommandContext,
  AutomationCommandDefinition,
} from './automation-command.types';

const normalizedRegionSchema = z
  .object({
    left: z.number().min(0).max(1),
    top: z.number().min(0).max(1),
    width: z.number().min(0).max(1),
    height: z.number().min(0).max(1),
  })
  .optional();

const visionModelSchema = z.object({
  visionProviderId: z.string().trim().min(1).max(80).optional(),
  visionModelId: z.string().trim().min(1).max(120).optional(),
});

const observeSchema = visionModelSchema.extend({
  maxDetections: z.number().int().min(1).max(100).optional().default(40),
});

const locateSchema = visionModelSchema.extend({
  query: z.string().trim().min(1).max(500),
  threshold: z.number().min(0).max(1).optional().default(0.5),
  maxResults: z.number().int().min(1).max(50).optional().default(5),
  region: normalizedRegionSchema,
});

@Injectable()
export class VisionAutomationCommandsService {
  constructor(
    private readonly providers: AutomationAiProviderService,
    private readonly vision: AutomationVisionService,
  ) {}

  list(): AutomationCommandDefinition[] {
    return [
      {
        uses: 'vision.observe',
        label: 'Observe screen',
        description:
          'Captures the current screen and returns normalized detected elements.',
        aiTool: {
          label: 'Inspect current screen visually',
          description:
            'Captures the screen and returns UI hierarchy, OCR, visual candidates, and a vision hypothesis. Treat visual guesses as uncertain until confirmed by tool facts or a fresh observation.',
        },
        requiredPermissions: ['automations:run'],
        schema: observeSchema,
        outputs: [
          {
            key: 'width',
            label: 'Width',
            type: 'number',
            description: 'Original screenshot width.',
          },
          {
            key: 'height',
            label: 'Height',
            type: 'number',
            description: 'Original screenshot height.',
          },
          {
            key: 'detections',
            label: 'Detections',
            type: 'array',
            description: 'Detected UI elements with normalized bounds.',
          },
          {
            key: 'summary',
            label: 'Vision summary',
            type: 'string',
            description: 'Optional vision model summary.',
          },
        ],
        editor: {
          category: 'Vision',
          iconKey: 'scan',
          inputDefaults: { maxDetections: 40 },
          yamlSnippetFields: ['maxDetections'],
        },
        execute: async (
          rawInput: unknown,
          context: AutomationCommandContext,
        ) => {
          const input = observeSchema.parse(rawInput);
          const visionModel = await this.resolveVisionModel(input);
          const observation = await this.vision.observe(context, visionModel);
          const detections = observation.detections.slice(
            0,
            input.maxDetections,
          );
          const uiStatus = observation.uiXml
            ? `UI hierarchy ${observation.uiXml.status}, ${observation.uiXml.nodeCount} node(s), ${observation.uiXml.detectionCount ?? detections.length} labeled detection(s)`
            : 'UI hierarchy unavailable';
          const ocrStatus = observation.ocr
            ? `OCR ${observation.ocr.status}, ${observation.ocr.detections.length} text box(es)`
            : 'OCR unavailable';
          const visionStatus = observation.summary
            ? 'Vision summary available'
            : observation.visionSummaryError
              ? `Vision summary failed: ${observation.visionSummaryError}`
              : 'Vision summary unavailable';
          return {
            summary: `Screen captured. ${uiStatus}. ${ocrStatus}. ${visionStatus}.`,
            data: {
              width: observation.image.width,
              height: observation.image.height,
              capturedAt: observation.image.capturedAt,
              detections,
              summary: observation.summary ?? null,
              uiXml: observation.uiXml ?? null,
              ocr: observation.ocr ?? null,
            },
          };
        },
      },
      {
        uses: 'vision.locate',
        label: 'Locate on screen',
        description:
          'Finds visible UI elements by text, label, role, or description.',
        aiTool: {
          label: 'Locate visible screen target',
          description:
            'Finds a visible target by text, icon hypothesis, role, or description on the current screenshot. Use it to ground a coordinate for visible controls; it does not confirm app identity or task completion by itself.',
        },
        requiredPermissions: ['automations:run'],
        schema: locateSchema,
        outputs: [
          {
            key: 'matches',
            label: 'Matches',
            type: 'array',
            description: 'Matching detections with normalized bounds.',
          },
          {
            key: 'found',
            label: 'Found',
            type: 'boolean',
            description: 'Whether at least one match was found.',
          },
        ],
        editor: {
          category: 'Vision',
          iconKey: 'scan-search',
          inputDefaults: {
            query: '',
            threshold: 0.5,
            maxResults: 5,
          },
          yamlSnippetFields: ['query', 'threshold', 'maxResults'],
        },
        execute: async (
          rawInput: unknown,
          context: AutomationCommandContext,
        ) => {
          const input = locateSchema.parse(rawInput);
          const visionModel = await this.resolveVisionModel(input);
          const result = await this.vision.locate(
            context,
            {
              query: input.query,
              threshold: input.threshold,
              maxResults: input.maxResults,
              ...(input.region ? { region: input.region } : {}),
            },
            visionModel,
          );
          return {
            summary:
              result.matches.length > 0
                ? `Found ${result.matches.length} match(es) for "${input.query}".`
                : `No matches found for "${input.query}".${result.reason ? ` ${result.reason}` : ''}`,
            data: {
              ...result,
              found: result.matches.length > 0,
            },
          };
        },
      },
    ];
  }

  private async resolveVisionModel(input: {
    visionProviderId?: string;
    visionModelId?: string;
  }) {
    if (!input.visionProviderId && !input.visionModelId) return undefined;
    return this.providers.getProvider(
      input.visionProviderId,
      input.visionModelId,
      'vision',
    );
  }
}
