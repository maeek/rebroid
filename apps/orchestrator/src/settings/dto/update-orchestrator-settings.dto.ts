import { PartialType } from '@nestjs/swagger';
import { OrchestratorSettingsDto } from './orchestrator-settings.dto';

export class UpdateOrchestratorSettingsDto extends PartialType(
  OrchestratorSettingsDto,
) {}
