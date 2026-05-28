import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  SystemResourceCapacityDto,
  SystemResourcesDto,
} from './dto/system-resources.dto';
import { SystemResourcesService } from './system-resources.service';

@ApiTags('system-resources')
@Controller('system-resources')
export class SystemResourcesController {
  constructor(private readonly resources: SystemResourcesService) {}

  @Get('capacity')
  @ApiOkResponse({ type: SystemResourceCapacityDto })
  getCapacity() {
    return this.resources.getCapacity();
  }

  @Get()
  @ApiOkResponse({ type: SystemResourcesDto })
  getUsage(@Query('refreshVolumes') refreshVolumes?: string) {
    return this.resources.getUsage(refreshVolumes === 'true');
  }
}
