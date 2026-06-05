import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import type { AutomationCommandDefinition } from './automation-command.types';
import type { AutomationAiRunInput } from '../ai/automation-ai.types';

const aiRunSchema = z.object({
  prompt: z.string().trim().min(1).max(12_000),
  providerId: z.string().trim().min(1).max(80).optional(),
  modelId: z.string().trim().min(1).max(120).optional(),
  maxToolCalls: z.number().int().min(1).max(100).default(20),
  timeoutMs: z.number().int().min(1_000).max(900_000).default(120_000),
  allowedTools: z.array(z.string().trim().min(1).max(120)).max(100).optional(),
  requireFinalAnswer: z.boolean().default(true),
});

@Injectable()
export class AiAutomationCommandsService {
  list(): AutomationCommandDefinition[] {
    return [
      {
        uses: 'ai.run',
        label: 'AI run',
        description:
          'Runs an AI harness that can call permitted automation tools to satisfy a prompt.',
        requiredPermissions: ['automations:run-ai'],
        schema: aiRunSchema,
        outputs: [
          {
            key: 'finalText',
            label: 'Final text',
            type: 'string',
            description: 'Visible final answer from the AI step.',
          },
          {
            key: 'toolCalls',
            label: 'Tool calls',
            type: 'number',
            description: 'Number of tool calls executed by the AI step.',
          },
        ],
        editor: {
          category: 'AI',
          iconKey: 'sparkles',
          inputDefaults: {
            prompt: 'Inspect the screen and complete the requested task.',
            maxToolCalls: 20,
            timeoutMs: 120000,
            requireFinalAnswer: true,
          },
          inputFieldOrder: [
            'prompt',
            'providerId',
            'modelId',
            'allowedTools',
            'maxToolCalls',
            'timeoutMs',
            'requireFinalAnswer',
          ],
          yamlSnippetFields: ['prompt', 'maxToolCalls', 'timeoutMs'],
        },
        execute: async (input, context) => {
          if (!context.aiHarness) {
            throw new Error(
              'AI harness is not available in this automation context.',
            );
          }
          if (
            !context.runId ||
            !context.ownerUserId ||
            !context.stepId ||
            !context.path ||
            !context.toolExecutor
          ) {
            throw new Error('AI harness context is incomplete.');
          }
          return context.aiHarness.run(input as AutomationAiRunInput, {
            ...context,
            runId: context.runId,
            ownerUserId: context.ownerUserId,
            stepId: context.stepId,
            path: context.path,
            toolExecutor: context.toolExecutor,
          });
        },
      },
    ];
  }
}
