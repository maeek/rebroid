import { applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional, type ApiPropertyOptions } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
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

export const OptionalNetworkPolicyEnabled = (options: ApiPropertyOptions) =>
  applyDecorators(
    IsBoolean(),
    IsOptional(),
    ApiPropertyOptional({ type: Boolean, ...options }),
  );

export const OptionalNetworkPolicyAllowCidrs = () =>
  applyDecorators(
    IsIpv4Cidr({ each: true }),
    MaxLength(64, { each: true }),
    IsString({ each: true }),
    IsArray(),
    Transform(({ value }) => toStringArray(value)),
    IsOptional(),
    ApiPropertyOptional({
      description:
        'Additional app-specific destination CIDRs the Android container may reach. Backend default destinations such as API_IP are applied automatically and are not stored here.',
      example: ['10.20.0.0/16', '203.0.113.10/32'],
      type: [String],
    }),
  );
