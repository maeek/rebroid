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
  AutomationAiModelCatalogProviderDto,
  AutomationAiProviderCandidateHealthDto,
  AutomationAiProviderHealthDto,
  AutomationAiProviderDto,
  AutomationAiProviderModelDownloadDto,
  AutomationAiProviderModelDto,
  AutomationAiProviderRemoteModelDto,
  CreateAutomationAiProviderDto,
  CreateAutomationAiProviderModelDto,
  DownloadAutomationAiProviderModelDto,
  UpdateAutomationAiProviderDto,
  UpdateAutomationAiProviderModelDto,
} from './dto/automation-ai-provider.dto';
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

  @Get('ai-providers')
  @ApiOkResponse({ type: AutomationAiProviderDto, isArray: true })
  listAiProviders() {
    return this.settings.listAiProviders();
  }

  @Post('ai-providers')
  @ApiOkResponse({ type: AutomationAiProviderDto })
  createAiProvider(@Body() dto: CreateAutomationAiProviderDto) {
    return this.settings.createAiProvider(dto);
  }

  @Post('ai-providers/health')
  @ApiOkResponse({ type: AutomationAiProviderHealthDto })
  checkAiProviderCandidateHealth(
    @Body() dto: AutomationAiProviderCandidateHealthDto,
  ) {
    return this.settings.checkAiProviderCandidateHealth(dto);
  }

  @Get('ai-providers/:providerId/health')
  @ApiOkResponse({ type: AutomationAiProviderHealthDto })
  checkAiProviderHealth(
    @Param('providerId') providerId: string,
    @Query('modelId') modelId?: string,
  ) {
    return this.settings.checkAiProviderHealth(providerId, modelId);
  }

  @Get('ai-providers/:providerId/remote-models')
  @ApiOkResponse({ type: AutomationAiProviderRemoteModelDto, isArray: true })
  listAiProviderRemoteModels(@Param('providerId') providerId: string) {
    return this.settings.listAiProviderRemoteModels(providerId);
  }

  @Patch('ai-providers/:providerId')
  @ApiOkResponse({ type: AutomationAiProviderDto })
  updateAiProvider(
    @Param('providerId') providerId: string,
    @Body() dto: UpdateAutomationAiProviderDto,
  ) {
    return this.settings.updateAiProvider(providerId, dto);
  }

  @Delete('ai-providers/:providerId')
  @HttpCode(204)
  @ApiNoContentResponse()
  deleteAiProvider(@Param('providerId') providerId: string) {
    return this.settings.deleteAiProvider(providerId);
  }

  @Post('ai-providers/:providerId/models')
  @ApiOkResponse({ type: AutomationAiProviderModelDto })
  createAiProviderModel(
    @Param('providerId') providerId: string,
    @Body() dto: CreateAutomationAiProviderModelDto,
  ) {
    return this.settings.createAiProviderModel(providerId, dto);
  }

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

  @Get('ai-providers/:providerId/models/downloads/:downloadId')
  @ApiOkResponse({ type: AutomationAiProviderModelDownloadDto })
  getAiProviderModelDownload(
    @Param('providerId') providerId: string,
    @Param('downloadId') downloadId: string,
  ) {
    return this.settings.getAiProviderModelDownload(providerId, downloadId);
  }

  @Patch('ai-providers/:providerId/models/:modelId')
  @ApiOkResponse({ type: AutomationAiProviderModelDto })
  updateAiProviderModel(
    @Param('providerId') providerId: string,
    @Param('modelId') modelId: string,
    @Body() dto: UpdateAutomationAiProviderModelDto,
  ) {
    return this.settings.updateAiProviderModel(providerId, modelId, dto);
  }

  @Delete('ai-providers/:providerId/models/:modelId')
  @HttpCode(204)
  @ApiNoContentResponse()
  deleteAiProviderModel(
    @Param('providerId') providerId: string,
    @Param('modelId') modelId: string,
  ) {
    return this.settings.deleteAiProviderModel(providerId, modelId);
  }

  @Get('ai-model-catalog')
  @ApiOkResponse({ type: AutomationAiModelCatalogProviderDto, isArray: true })
  listAiModelCatalog() {
    return this.settings.listEnabledAiModelCatalog();
  }
}
