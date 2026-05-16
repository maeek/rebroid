import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { OrchestratorSettingsDto } from './dto/orchestrator-settings.dto';
import { UpdateOrchestratorSettingsDto } from './dto/update-orchestrator-settings.dto';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @ApiOkResponse({ type: OrchestratorSettingsDto })
  getSettings() {
    return this.settings.getSettings();
  }

  @Patch()
  @ApiOkResponse({ type: OrchestratorSettingsDto })
  updateSettings(@Body() dto: UpdateOrchestratorSettingsDto) {
    return this.settings.updateSettings(dto);
  }

  @Post('reset')
  @ApiOkResponse({ type: OrchestratorSettingsDto })
  resetSettings() {
    return this.settings.resetSettings();
  }
}
