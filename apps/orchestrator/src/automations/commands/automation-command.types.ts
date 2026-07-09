import { z } from 'zod';
import type {
  AndroidAutomationAdbPort,
  AndroidAutomationApplication,
  AndroidAutomationDisplayPort,
  AndroidAutomationNetworkPolicyPort,
} from '../../android-apps/contracts/android-apps-automation.port';
import type { AutomationAiHarnessService } from '../ai/automation-ai-harness.service';
import type {
  AutomationCommandEditorMetadata,
  AutomationCommandOutputMetadata,
} from '@rebroid/automation-core/command-registry';

export interface AutomationCommandContext {
  app: AndroidAutomationApplication;
  adb: AndroidAutomationAdbPort;
  display: AndroidAutomationDisplayPort;
  networkPolicy: AndroidAutomationNetworkPolicyPort;
  aiHarness?: AutomationAiHarnessService;
  runId?: string;
  ownerUserId?: string;
  stepId?: string;
  parentStepId?: string | null;
  path?: string;
  abortSignal?: AbortSignal;
  toolExecutor?: (tool: {
    name: string;
    arguments: Record<string, unknown>;
  }) => Promise<AutomationCommandResult>;
}

export interface AutomationCommandResult {
  summary: string;
  data?: Record<string, unknown>;
}

export interface AutomationCommandEditorExample {
  label: string;
  input: Record<string, unknown>;
}

export type AutomationCommandEditorMetadataOverride =
  Partial<AutomationCommandEditorMetadata>;

export interface AutomationCommandDefinition<
  Input extends z.ZodType = z.ZodType,
> {
  uses: string;
  label: string;
  description: string;
  aiTool?: {
    name?: string;
    label?: string;
    description?: string;
  };
  requiredPermissions: string[];
  schema: Input;
  outputs?: AutomationCommandOutputMetadata[];
  editor?: AutomationCommandEditorMetadataOverride;
  execute: (
    input: z.infer<Input>,
    context: AutomationCommandContext,
  ) => Promise<AutomationCommandResult>;
}

export type AutomationCommandCatalogEntry = Pick<
  AutomationCommandDefinition,
  'uses' | 'label' | 'description' | 'requiredPermissions'
>;

export type { AutomationCommandEditorMetadata };
export type { AutomationCommandOutputMetadata };
