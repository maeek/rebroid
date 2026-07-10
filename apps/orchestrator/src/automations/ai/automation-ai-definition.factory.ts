import { Injectable } from '@nestjs/common';
import { AutomationDefinition } from '@rebroid/automation-core/definition';
import { AutomationDefinitionService } from '../definition/automation-definition.service';

export type AutomationAiDefinitionInput = {
  name: string;
  prompt: string;
  conversation?: Array<{ role: 'user' | 'assistant'; content: string }>;
  providerId?: string;
  modelId?: string;
  visionProviderId?: string;
  visionModelId?: string;
  clientMessageId?: string;
  allowedTools?: string[];
  capabilities?: string[];
  agentMode?: 'adaptive' | 'controller' | 'planned';
  rawShellPolicy?: 'deny' | 'allowlisted';
  maxActions?: number;
  maxToolCalls?: number;
  timeoutMs?: number;
};

@Injectable()
export class AutomationAiDefinitionFactory {
  constructor(private readonly definitions: AutomationDefinitionService) {}

  create({
    name,
    prompt,
    providerId,
    modelId,
    visionProviderId,
    visionModelId,
    conversation,
    allowedTools,
    capabilities,
    agentMode = 'adaptive',
    rawShellPolicy = 'deny',
    maxActions,
    maxToolCalls = 20,
    timeoutMs = 120_000,
    clientMessageId,
  }: AutomationAiDefinitionInput): AutomationDefinition {
    return this.definitions.normalize({
      apiVersion: 'rebroid.io/automation/v1',
      kind: 'AndroidAutomation',
      metadata: {
        name,
        description: prompt.trim().slice(0, 240),
        tags: [{ name: 'ai', color: '#0ea5e9' }],
      },
      spec: {
        steps: [
          {
            id: 'ai-run',
            uses: 'ai.run',
            with: {
              prompt,
              ...(conversation ? { conversation } : {}),
              ...(providerId ? { providerId } : {}),
              ...(modelId ? { modelId } : {}),
              ...(visionProviderId ? { visionProviderId } : {}),
              ...(visionModelId ? { visionModelId } : {}),
              ...(clientMessageId ? { clientMessageId } : {}),
              ...(allowedTools ? { allowedTools } : {}),
              ...(capabilities ? { capabilities } : {}),
              agentMode,
              rawShellPolicy,
              ...(maxActions ? { maxActions } : {}),
              maxToolCalls,
              timeoutMs,
              requireFinalAnswer: true,
            },
          },
        ],
      },
    });
  }
}
