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
  capabilities?: string[];
  agentMode?: 'adaptive' | 'controller' | 'planned';
  rawShellPolicy?: 'deny' | 'allowlisted';
  maxActions?: number;
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
    capabilities,
    agentMode = 'adaptive',
    rawShellPolicy = 'deny',
    maxActions = 20,
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
              ...(capabilities ? { capabilities } : {}),
              agentMode,
              rawShellPolicy,
              maxActions,
              timeoutMs,
            },
          },
        ],
      },
    });
  }
}
