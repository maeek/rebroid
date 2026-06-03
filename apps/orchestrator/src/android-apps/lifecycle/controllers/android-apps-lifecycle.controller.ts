import { Body, Controller, Param, Post, Put } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApplicationCommandResultDto } from '../../common/dto/application-command-result.dto';
import { StartAndroidApplicationDto } from '../dto/start-android-application.dto';
import { SwitchApplicationProfileDto } from '../dto/switch-application-profile.dto';
import { UpdateAndroidApplicationApkDto } from '../dto/update-android-application-apk.dto';
import { AndroidAppsLifecycleService } from '../services/android-apps-lifecycle.service';

@ApiTags('app-lifecycle')
@Controller('apps')
export class AndroidAppsLifecycleController {
  constructor(private readonly lifecycle: AndroidAppsLifecycleService) {}

  @Post(':id/lifecycle/profile')
  @ApiOperation({
    summary:
      'Select the runtime profile volume used by the next container start.',
  })
  @ApiOkResponse({ type: ApplicationCommandResultDto })
  async switchProfile(
    @Param('id') id: string,
    @Body() dto: SwitchApplicationProfileDto,
  ) {
    return ApplicationCommandResultDto.fromEntity(
      await this.lifecycle.switchProfile(id, dto),
    );
  }

  @Post(':id/lifecycle/start')
  @ApiOperation({
    summary:
      'Start the application container, optionally selecting a runtime profile.',
  })
  @ApiOkResponse({ type: ApplicationCommandResultDto })
  async start(
    @Param('id') id: string,
    @Body() dto: StartAndroidApplicationDto,
  ) {
    return ApplicationCommandResultDto.fromEntity(
      await this.lifecycle.start(id, dto),
    );
  }

  @Post(':id/lifecycle/stop')
  @ApiOkResponse({ type: ApplicationCommandResultDto })
  async stop(@Param('id') id: string) {
    return ApplicationCommandResultDto.fromEntity(
      await this.lifecycle.stop(id),
    );
  }

  @Put(':id/lifecycle/apk')
  @ApiOkResponse({ type: ApplicationCommandResultDto })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['uploadedApkId'],
      properties: {
        uploadedApkId: {
          type: 'string',
          example: '98a530d6-a45d-466a-9cb4-c023067c4971',
        },
      },
    },
  })
  async updateApk(
    @Param('id') id: string,
    @Body() dto: UpdateAndroidApplicationApkDto,
  ) {
    return ApplicationCommandResultDto.fromEntity(
      await this.lifecycle.updateApk(id, dto),
    );
  }
}
