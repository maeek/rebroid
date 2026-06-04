import { BadRequestException, Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  parseAllowCidrs,
  normalizeIpv4Cidr,
} from '../../network-policy/utils/network-policy.utils';
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

const unsupportedBlockCommand = async () => {
  throw new BadRequestException(
    'Block CIDR commands require deny-list support in the firewall agent and are not available yet.',
  );
};

const unique = (values: string[]) => [...new Set(values)];

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
          const current = parseAllowCidrs(app.networkPolicyAllowCidrs);
          const next = unique([...current, cidr]);
          await networkPolicy.updateNetworkPolicy(app.id, {
            networkPolicyAllowCidrs: next,
          });
          app.networkPolicyAllowCidrs = JSON.stringify(next);
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
          const next = parseAllowCidrs(app.networkPolicyAllowCidrs).filter(
            (item) => item !== cidr,
          );
          await networkPolicy.updateNetworkPolicy(app.id, {
            networkPolicyAllowCidrs: next,
          });
          app.networkPolicyAllowCidrs = JSON.stringify(next);
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
        uses: 'container.network.blockCidr',
        label: 'Block CIDR',
        description: 'Reserved for future firewall deny-list support.',
        requiredPermissions: ['automations:manage-network'],
        schema: cidrSchema,
        execute: unsupportedBlockCommand,
      },
      {
        uses: 'container.network.removeBlockedCidr',
        label: 'Remove blocked CIDR',
        description: 'Reserved for future firewall deny-list support.',
        requiredPermissions: ['automations:manage-network'],
        schema: cidrSchema,
        execute: unsupportedBlockCommand,
      },
      {
        uses: 'container.network.clearBlockedCidrs',
        label: 'Clear blocked CIDRs',
        description: 'Reserved for future firewall deny-list support.',
        requiredPermissions: ['automations:manage-network'],
        schema: z.object({}),
        execute: unsupportedBlockCommand,
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
