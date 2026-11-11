import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsObject, ValidateIf, ValidateNested } from 'class-validator';
import { AndroidRenderingSettingsDto } from './android-rendering-settings.dto';
import {
  OptionalServicesSettingsDto,
  OrchestratorSettingsDto,
} from './orchestrator-settings.dto';

class UpdateOptionalServicesSettingsDto extends PartialType(
  OptionalServicesSettingsDto,
  { skipNullProperties: false },
) {}

export class UpdateOrchestratorSettingsDto extends PartialType(
  OmitType(OrchestratorSettingsDto, ['androidRendering', 'services'] as const),
) {
  @ApiPropertyOptional({ type: AndroidRenderingSettingsDto })
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => AndroidRenderingSettingsDto)
  androidRendering?: AndroidRenderingSettingsDto;

  @ApiPropertyOptional({ type: UpdateOptionalServicesSettingsDto })
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => UpdateOptionalServicesSettingsDto)
  services?: UpdateOptionalServicesSettingsDto;
}
