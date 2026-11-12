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

const ocrStatusOutput = {
  key: 'ocrStatus',
  label: 'OCR status',
  type: 'string',
  description: 'Whether OCR was available, disabled, failed, or unavailable.',
} as const;

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
            key: 'visionSummary',
            label: 'Vision summary',
            type: 'string',
            description: 'Optional vision model summary.',
          },
          ocrStatusOutput,
          {
            key: 'ocrTextCount',
            label: 'OCR text box count',
            type: 'number',
            description: 'Total OCR text boxes before the output limit.',
          },
          {
            key: 'ocrDetections',
            label: 'OCR detections',
            type: 'array',
            description:
              'Detected text with normalized bounds, limited by maxDetections.',
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
          const ocrSummary = observation.ocr
            ? `OCR ${observation.ocr.status}, ${observation.ocr.detections.length} text box(es)`
            : 'OCR unavailable';
          const ocrDetections =
            observation.ocr?.detections.slice(0, input.maxDetections) ?? [];
          const visionStatus = observation.summary
            ? 'Vision summary available'
            : observation.visionSummaryError
              ? `Vision summary failed: ${observation.visionSummaryError}`
              : 'Vision summary unavailable';
          const screenSummary = context.visionSnapshot
            ? 'Screen observed'
            : 'Screen captured';
          return {
            summary: `${screenSummary}. ${uiStatus}. ${ocrSummary}. ${visionStatus}.`,
            data: {
              width: observation.image.width,
              height: observation.image.height,
              capturedAt: observation.image.capturedAt,
              detections,
              visionSummary: observation.summary ?? null,
              uiXml: observation.uiXml ?? null,
              ocrStatus: observation.ocr?.status ?? 'unavailable',
              ocrTextCount: observation.ocr?.detections.length ?? 0,
              ocrDetections,
              ocr: observation.ocr
                ? { ...observation.ocr, detections: ocrDetections }
                : null,
            },
          };
        },
      },
      {
        uses: 'vision.locate',
        label: 'Locate on screen',
        description:
          'Finds visible UI elements by text, label, role, or description.',
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
            key: 'centerX',
            label: 'First match X',
            type: 'number',
            description:
              'Normalized horizontal center of the first match, when found.',
          },
          {
            key: 'centerY',
            label: 'First match Y',
            type: 'number',
            description:
              'Normalized vertical center of the first match, when found.',
          },
          {
            key: 'found',
            label: 'Found',
            type: 'boolean',
            description: 'Whether at least one match was found.',
          },
          {
            key: 'outcome',
            label: 'Search outcome',
            type: 'string',
            description:
              'found, not_found after a completed screen search, or inconclusive when recognition was unavailable.',
          },
          ocrStatusOutput,
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
              maxResults: context.visionSnapshot
                ? Math.min(input.maxResults, 5)
                : input.maxResults,
              ...(input.region ? { region: input.region } : {}),
            },
            visionModel,
          );
          const { visionSnapshot } = context;
          const found = result.outcome === 'found';
          const center = found ? result.matches[0]?.center : undefined;
          const summary = found
            ? `Found ${result.matches.length} match(es) for "${input.query}".`
            : `Search for "${input.query}" returned ${result.outcome}.${result.reason ? ` ${result.reason}` : ''}`;
          return {
            summary,
            outcome: found
              ? 'succeeded'
              : result.outcome === 'not_found'
                ? 'not_found'
                : 'uncertain',
            data: {
              ...result,
              found,
              ...(center ? { centerX: center.x, centerY: center.y } : {}),
            },
            ...(visionSnapshot && found
              ? {
                  snapshotMatches: {
                    snapshotId: visionSnapshot.snapshotId,
                    matches: result.matches,
                  },
                }
              : {}),
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
