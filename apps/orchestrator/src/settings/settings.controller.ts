import { RequiresFeature } from '../feature-flags/feature-flags.guard';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  AutomationAiProviderCandidateHealthDto,
  AutomationAiProviderDto,
  AutomationAiProviderModelDto,
  CreateAutomationAiProviderDto,
  CreateAutomationAiProviderModelDto,
  UpdateAutomationAiProviderDto,
  UpdateAutomationAiProviderModelDto,
} from './dto/automation-ai-provider.dto';
import {
  AutomationAiProviderModelDownloadDto,
  DownloadAutomationAiProviderModelDto,
} from './dto/automation-ai-provider-download.dto';
import {
  AutomationAiModelCatalogProviderDto,
  AutomationAiProviderHealthDto,
  AutomationAiProviderRemoteModelDto,
} from './dto/automation-ai-provider-health.dto';
import { OrchestratorSettingsDto } from './dto/orchestrator-settings.dto';
import { UpdateOrchestratorSettingsDto } from './dto/update-orchestrator-settings.dto';
import { SettingsService } from './settings.service';
import type { AutomationAiProviderModelRole } from './contracts/ai-provider';

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

  @RequiresFeature('feature.ai')
  @Get('ai-providers')
  @ApiOkResponse({ type: AutomationAiProviderDto, isArray: true })
  listAiProviders() {
    return this.settings.listAiProviders();
  }

  @RequiresFeature('feature.ai')
  @Post('ai-providers')
  @ApiOkResponse({ type: AutomationAiProviderDto })
  createAiProvider(@Body() dto: CreateAutomationAiProviderDto) {
    return this.settings.createAiProvider(dto);
  }

  @RequiresFeature('feature.ai')
  @Post('ai-providers/health')
  @ApiOkResponse({ type: AutomationAiProviderHealthDto })
  checkAiProviderCandidateHealth(
    @Body() dto: AutomationAiProviderCandidateHealthDto,
  ) {
    return this.settings.checkAiProviderCandidateHealth(dto);
  }

  @RequiresFeature('feature.ai')
  @Get('ai-providers/:providerId/health')
  @ApiOkResponse({ type: AutomationAiProviderHealthDto })
  checkAiProviderHealth(
    @Param('providerId') providerId: string,
    @Query('modelId') modelId?: string,
    @Query('role') role?: AutomationAiProviderModelRole,
  ) {
    return this.settings.checkAiProviderHealth(providerId, modelId, role);
  }

  @RequiresFeature('feature.ai')
  @Get('ai-providers/:providerId/remote-models')
  @ApiOkResponse({ type: AutomationAiProviderRemoteModelDto, isArray: true })
  listAiProviderRemoteModels(@Param('providerId') providerId: string) {
    return this.settings.listAiProviderRemoteModels(providerId);
  }

  @RequiresFeature('feature.ai')
  @Patch('ai-providers/:providerId')
  @ApiOkResponse({ type: AutomationAiProviderDto })
  updateAiProvider(
    @Param('providerId') providerId: string,
    @Body() dto: UpdateAutomationAiProviderDto,
  ) {
    return this.settings.updateAiProvider(providerId, dto);
  }

  @RequiresFeature('feature.ai')
  @Delete('ai-providers/:providerId')
  @HttpCode(204)
  @ApiNoContentResponse()
  deleteAiProvider(@Param('providerId') providerId: string) {
    return this.settings.deleteAiProvider(providerId);
  }

  @RequiresFeature('feature.ai')
  @Post('ai-providers/:providerId/models')
  @ApiOkResponse({ type: AutomationAiProviderModelDto })
  createAiProviderModel(
    @Param('providerId') providerId: string,
    @Body() dto: CreateAutomationAiProviderModelDto,
  ) {
    return this.settings.createAiProviderModel(providerId, dto);
  }

  @RequiresFeature('feature.ai')
  @Post('ai-providers/:providerId/models/download')
  @ApiOkResponse({ type: AutomationAiProviderModelDownloadDto })
  downloadAiProviderModel(
    @Param('providerId') providerId: string,
    @Body() dto: DownloadAutomationAiProviderModelDto,
  ) {
    return this.settings.downloadAiProviderModel(
      providerId,
      dto.modelId,
      dto.label,
    );
  }

  @RequiresFeature('feature.ai')
  @Get('ai-providers/:providerId/models/downloads/:downloadId')
  @ApiOkResponse({ type: AutomationAiProviderModelDownloadDto })
  getAiProviderModelDownload(
    @Param('providerId') providerId: string,
    @Param('downloadId') downloadId: string,
  ) {
    return this.settings.getAiProviderModelDownload(providerId, downloadId);
  }

  @RequiresFeature('feature.ai')
  @Patch('ai-providers/:providerId/models/:modelId')
  @ApiOkResponse({ type: AutomationAiProviderModelDto })
  updateAiProviderModel(
    @Param('providerId') providerId: string,
    @Param('modelId') modelId: string,
    @Body() dto: UpdateAutomationAiProviderModelDto,
  ) {
    return this.settings.updateAiProviderModel(providerId, modelId, dto);
  }

  @RequiresFeature('feature.ai')
  @Delete('ai-providers/:providerId/models/:modelId')
  @HttpCode(204)
  @ApiNoContentResponse()
  deleteAiProviderModel(
    @Param('providerId') providerId: string,
    @Param('modelId') modelId: string,
  ) {
    return this.settings.deleteAiProviderModel(providerId, modelId);
  }

  @RequiresFeature('feature.ai')
  @Get('ai-model-catalog')
  @ApiOkResponse({ type: AutomationAiModelCatalogProviderDto, isArray: true })
  listAiModelCatalog() {
    return this.settings.listEnabledAiModelCatalog();
  }
}
