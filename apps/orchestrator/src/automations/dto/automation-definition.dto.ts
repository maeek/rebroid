import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AutomationTagDto {
  @ApiProperty({ example: 'smoke' })
  name!: string;

  @ApiProperty({ example: '#0ea5e9' })
  color!: string;
}

export class AutomationDefinitionStepDto {
  @ApiProperty({ example: 'wake-device' })
  id!: string;

  @ApiProperty({ example: 'android.viewerCommand' })
  uses!: string;

  @ApiProperty({ type: Object, example: { command: 'wake' } })
  with!: Record<string, unknown>;
}

export class AutomationDefinitionMetadataDto {
  @ApiProperty({ example: 'Prepare app environment' })
  name!: string;

  @ApiPropertyOptional({ example: 'Optional notes' })
  description?: string;

  @ApiPropertyOptional({
    type: AutomationTagDto,
    isArray: true,
    example: [
      { name: 'smoke', color: '#0ea5e9' },
      { name: 'login', color: '#22c55e' },
    ],
  })
  tags?: AutomationTagDto[];
}

export class AutomationDefinitionSpecDto {
  @ApiProperty({ type: Object, isArray: true })
  steps!: unknown[];
}

export class AutomationDefinitionDto {
  @ApiProperty({ example: 'rebroid.io/automation/v1' })
  apiVersion!: string;

  @ApiProperty({ example: 'AndroidAutomation' })
  kind!: string;

  @ApiProperty({ type: AutomationDefinitionMetadataDto })
  metadata!: AutomationDefinitionMetadataDto;

  @ApiProperty({ type: AutomationDefinitionSpecDto })
  spec!: AutomationDefinitionSpecDto;
}
