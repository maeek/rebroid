import { z } from 'zod';
import { AndroidApplication } from '../../android-apps/android-application.entity';
import { AndroidAppsNetworkPolicyService } from '../../android-apps/network/services/android-apps-network-policy.service';
import { AndroidAppsDisplaySidecarService } from '../../android-apps/viewer/services/android-apps-display-sidecar.service';
import { AndroidAppsSidecarAdbService } from '../../android-apps/viewer/services/android-apps-sidecar-adb.service';

export interface AutomationCommandContext {
  app: AndroidApplication;
  adb: AndroidAppsSidecarAdbService;
  display: AndroidAppsDisplaySidecarService;
  networkPolicy: AndroidAppsNetworkPolicyService;
}

export interface AutomationCommandResult {
  summary: string;
  data?: Record<string, unknown>;
}

export interface AutomationCommandEditorExample {
  label: string;
  input: Record<string, unknown>;
}

export interface AutomationCommandEditorMetadata {
  inputDefaults: Record<string, unknown>;
  inputFieldOrder: string[];
  yamlSnippetFields: string[];
  category?: string;
  iconKey?: string;
  examples?: AutomationCommandEditorExample[];
}

export type AutomationCommandEditorMetadataOverride =
  Partial<AutomationCommandEditorMetadata>;

export interface AutomationCommandDefinition<
  Input extends z.ZodType = z.ZodType,
> {
  uses: string;
  label: string;
  description: string;
  requiredPermissions: string[];
  schema: Input;
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
