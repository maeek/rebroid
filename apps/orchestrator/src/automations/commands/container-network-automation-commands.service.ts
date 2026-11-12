import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { normalizeIpv4Cidr } from '@rebroid/firewall-policy-core/policy';
import {
  AutomationCommandContext,
  AutomationCommandDefinition,
} from './automation-command.types';

const cidrSchema = z.object({
  cidr: z
    .string()
    .min(1)
    .max(64)
    .transform((value, context) => {
      const normalized = normalizeIpv4Cidr(value);
      if (!normalized) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'CIDR must be an IPv4 address or CIDR.',
        });
        return z.NEVER;
      }
      return normalized;
    }),
});

const restrictionsSchema = z.object({
  enabled: z.boolean(),
});

@Injectable()
export class ContainerNetworkAutomationCommandsService {
  list(): AutomationCommandDefinition[] {
    const commands = [
      {
        uses: 'container.network.allowCidr',
        label: 'Allow CIDR',
        description:
          'Adds a CIDR to the selected app container network allowlist.',
        requiredPermissions: ['automations:manage-network'],
        schema: cidrSchema,
        execute: async (
          { cidr }: z.infer<typeof cidrSchema>,
          { app, networkPolicy }: AutomationCommandContext,
        ) => {
          const updated = await networkPolicy.changeAllowedCidr(app.id, {
            operation: 'add',
            cidr,
          });
          app.networkPolicyAllowCidrs = updated.networkPolicyAllowCidrs;
          return { summary: `Allowed ${cidr}.` };
        },
      },
      {
        uses: 'container.network.removeAllowedCidr',
        label: 'Remove allowed CIDR',
        description:
          'Removes a CIDR from the selected app container network allowlist.',
        requiredPermissions: ['automations:manage-network'],
        schema: cidrSchema,
        execute: async (
          { cidr }: z.infer<typeof cidrSchema>,
          { app, networkPolicy }: AutomationCommandContext,
        ) => {
          const updated = await networkPolicy.changeAllowedCidr(app.id, {
            operation: 'remove',
            cidr,
          });
          app.networkPolicyAllowCidrs = updated.networkPolicyAllowCidrs;
          return { summary: `Removed allowed CIDR ${cidr}.` };
        },
      },
      {
        uses: 'container.network.clearAllowedCidrs',
        label: 'Clear allowed CIDRs',
        description:
          'Clears all custom CIDRs from the selected app container network allowlist.',
        requiredPermissions: ['automations:manage-network'],
        schema: z.object({}),
        execute: async (
          _input: Record<string, never>,
          { app, networkPolicy }: AutomationCommandContext,
        ) => {
          await networkPolicy.updateNetworkPolicy(app.id, {
            networkPolicyAllowCidrs: [],
          });
          app.networkPolicyAllowCidrs = '[]';
          return { summary: 'Cleared allowed CIDRs.' };
        },
      },
      {
        uses: 'container.network.setRestrictions',
        label: 'Set network restrictions',
        description:
          'Enables or disables Rebroid network restrictions for the selected app container.',
        requiredPermissions: ['automations:manage-network'],
        schema: restrictionsSchema,
        execute: async (
          { enabled }: z.infer<typeof restrictionsSchema>,
          { app, networkPolicy }: AutomationCommandContext,
        ) => {
          await networkPolicy.updateNetworkPolicy(app.id, {
            networkPolicyEnabled: enabled,
          });
          app.networkPolicyEnabled = enabled;
          return {
            summary: `Network restrictions ${enabled ? 'enabled' : 'disabled'}.`,
          };
        },
      },
      {
        uses: 'container.network.resetPolicy',
        label: 'Reset network policy',
        description: 'Enables restrictions and clears custom allowlist CIDRs.',
        requiredPermissions: ['automations:manage-network'],
        schema: z.object({}),
        execute: async (
          _input: Record<string, never>,
          { app, networkPolicy }: AutomationCommandContext,
        ) => {
          await networkPolicy.updateNetworkPolicy(app.id, {
            networkPolicyEnabled: true,
            networkPolicyAllowCidrs: [],
          });
          app.networkPolicyEnabled = true;
          app.networkPolicyAllowCidrs = '[]';
          return { summary: 'Network policy reset.' };
        },
      },
    ];
    return commands as unknown as AutomationCommandDefinition[];
  }
}
