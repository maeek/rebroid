import {
  AUTOMATION_AI_RUN_MAX_TIMEOUT_MS,
  isSelectableAiCapability,
} from '@rebroid/automation-core/ai-run';
import { Injectable } from '@nestjs/common';
import type { AutomationAiRunInput } from '../../settings/contracts/ai-provider';
import { z } from 'zod';
import type { AutomationCommandDefinition } from './automation-command.types';

const aiRunSchema = z.strictObject({
  prompt: z.string().trim().min(1).max(12_000),
  conversation: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1).max(12_000),
      }),
    )
    .max(40)
    .optional(),
  providerId: z.string().trim().min(1).max(80).optional(),
  modelId: z.string().trim().min(1).max(120).optional(),
  visionProviderId: z.string().trim().min(1).max(80).optional(),
  visionModelId: z.string().trim().min(1).max(120).optional(),
  clientMessageId: z.string().trim().min(1).max(120).optional(),
  maxActions: z.number().int().min(1).max(100).default(20),
  timeoutMs: z
    .number()
    .int()
    .min(1_000)
    .max(AUTOMATION_AI_RUN_MAX_TIMEOUT_MS)
    .default(120_000),
  capabilities: z
    .array(
      z.string().trim().min(1).max(120).refine(isSelectableAiCapability, {
        message: 'Command is unavailable to the device agent.',
      }),
    )
    .max(100)
    .optional(),
  agentMode: z.enum(['adaptive', 'controller', 'planned']).default('adaptive'),
  rawShellPolicy: z.enum(['deny', 'allowlisted']).default('deny'),
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
            key: 'status',
            label: 'Status',
            type: 'string',
            description: 'AI run status: completed or blocked.',
          },
          {
            key: 'completed',
            label: 'Completed',
            type: 'boolean',
            description: 'Whether the AI agent verified the requested outcome.',
          },
          {
            key: 'toolCalls',
            label: 'Tool calls',
            type: 'number',
            description: 'Number of tool calls executed by the AI step.',
          },
          {
            key: 'blockedReason',
            label: 'Blocked reason',
            type: 'string',
            description:
              'Why the AI run was blocked before returning a final answer.',
          },
          {
            key: 'evidence',
            label: 'Evidence',
            type: 'object',
            description:
              'Execution evidence including tool-call count and limit status.',
          },
        ],
        editor: {
          category: 'AI',
          iconKey: 'sparkles',
          inputDefaults: {
            prompt: 'Inspect the screen and complete the requested task.',
            maxActions: 20,
            agentMode: 'adaptive',
            rawShellPolicy: 'deny',
            timeoutMs: 120000,
          },
          inputFieldOrder: [
            'prompt',
            'providerId',
            'modelId',
            'visionProviderId',
            'visionModelId',
            'capabilities',
            'agentMode',
            'rawShellPolicy',
            'maxActions',
            'timeoutMs',
          ],
          yamlSnippetFields: ['prompt', 'maxActions', 'timeoutMs'],
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
            !context.executeCommand ||
            !context.withTarget
          ) {
            throw new Error('AI harness context is incomplete.');
          }
          return context.aiHarness.run(input as AutomationAiRunInput, {
            app: context.app,
            adb: context.adb,
            abortSignal: context.abortSignal,
            recordOcrExchange: context.recordOcrExchange,
            runId: context.runId,
            ownerUserId: context.ownerUserId,
            stepId: context.stepId,
            parentStepId: context.parentStepId,
            executeCommand: context.executeCommand,
            withTarget: context.withTarget,
          });
        },
      },
    ];
  }
}
