import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { DockerOperationLimitsDto } from '../dto/docker-operation-limits.dto';
import { DockerOperationSettingsService } from '../services/docker-operation-settings.service';

@ApiTags('docker')
@Controller('platform/docker/operation-limits')
export class DockerOperationSettingsController {
  constructor(private readonly settings: DockerOperationSettingsService) {}

  @Get()
  @ApiOkResponse({ type: DockerOperationLimitsDto })
  getLimits() {
    return this.settings.getLimits();
  }

  @Put()
  @ApiOkResponse({ type: DockerOperationLimitsDto })
  updateLimits(@Body() limits: DockerOperationLimitsDto) {
    return this.settings.updateLimits(limits);
  }
}
