import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const toStringArray = (value: unknown) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return value;
};

export class UpdateNetworkPolicyDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  networkPolicyEnabled?: boolean;

  @ApiPropertyOptional({
    description:
      'Additional app-specific destination CIDRs the Android container may reach. Backend default destinations such as API_IP are applied automatically and are not stored here.',
    example: ['10.20.0.0/16', '203.0.113.10/32'],
    type: [String],
  })
  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  networkPolicyAllowCidrs?: string[];
}
