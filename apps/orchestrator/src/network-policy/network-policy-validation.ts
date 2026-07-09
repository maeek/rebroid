import { ValidateBy, type ValidationOptions } from 'class-validator';
import { normalizeIpv4Cidr } from './utils/network-policy.utils';

export const toStringArray = (value: unknown) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return value;
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

export const IsIpv4Cidr = (validationOptions?: ValidationOptions) =>
  ValidateBy(
    {
      name: 'isIpv4Cidr',
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && Boolean(normalizeIpv4Cidr(value)),
        defaultMessage: () =>
          'Each allowlist entry must be an IPv4 address or CIDR.',
      },
    },
    validationOptions,
  );
