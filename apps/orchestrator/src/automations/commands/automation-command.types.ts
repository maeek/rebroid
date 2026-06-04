import { z } from 'zod';
import { AndroidApplication } from '../../android-apps/android-application.entity';
import { AndroidAppsNetworkPolicyService } from '../../android-apps/network/services/android-apps-network-policy.service';
import { AndroidAppsSidecarAdbService } from '../../android-apps/viewer/services/android-apps-sidecar-adb.service';

export interface AutomationCommandContext {
  app: AndroidApplication;
  adb: AndroidAppsSidecarAdbService;
  networkPolicy: AndroidAppsNetworkPolicyService;
}

export interface AutomationCommandResult {
  summary: string;
  data?: Record<string, unknown>;
}

export interface AutomationCommandDefinition<
  Input extends z.ZodType = z.ZodType,
> {
  uses: string;
  label: string;
  description: string;
  requiredPermissions: string[];
  schema: Input;
  execute: (
    input: z.infer<Input>,
    context: AutomationCommandContext,
  ) => Promise<AutomationCommandResult>;
}

export type AutomationCommandCatalogEntry = Pick<
  AutomationCommandDefinition,
  'uses' | 'label' | 'description' | 'requiredPermissions'
>;
