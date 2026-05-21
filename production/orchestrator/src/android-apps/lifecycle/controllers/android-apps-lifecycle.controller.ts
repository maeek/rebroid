import { Body, Controller, Param, Post, Put } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AndroidApplicationResponseDto } from '../../common/dto/android-application-response.dto';
import { toAndroidApplicationResponse } from '../../common/utils/android-apps-controller-response.utils';
import { StartAndroidApplicationDto } from '../dto/start-android-application.dto';
import { SwitchApplicationProfileDto } from '../dto/switch-application-profile.dto';
import { UpdateAndroidApplicationApkDto } from '../dto/update-android-application-apk.dto';
import { AndroidAppsLifecycleService } from '../services/android-apps-lifecycle.service';

@ApiTags('android-applications')
@Controller('android-applications')
export class AndroidAppsLifecycleController {
  constructor(private readonly lifecycle: AndroidAppsLifecycleService) {}

  @Post(':id/profile')
  @ApiOperation({
    summary:
      'Select the runtime profile volume used by the next container start.',
  })
  @ApiOkResponse({ type: AndroidApplicationResponseDto })
  switchProfile(
    @Param('id') id: string,
    @Body() dto: SwitchApplicationProfileDto,
  ) {
    return toAndroidApplicationResponse(this.lifecycle.switchProfile(id, dto));
  }

  @Post(':id/start')
  @ApiOperation({
    summary:
      'Start the application container, optionally selecting a runtime profile.',
  })
  @ApiOkResponse({ type: AndroidApplicationResponseDto })
  start(@Param('id') id: string, @Body() dto: StartAndroidApplicationDto) {
    return toAndroidApplicationResponse(this.lifecycle.start(id, dto));
  }

  @Post(':id/stop')
  @ApiOkResponse({ type: AndroidApplicationResponseDto })
  stop(@Param('id') id: string) {
    return toAndroidApplicationResponse(this.lifecycle.stop(id));
  }

  @Put(':id/apk')
  @ApiOkResponse({ type: AndroidApplicationResponseDto })
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
  updateApk(
    @Param('id') id: string,
    @Body() dto: UpdateAndroidApplicationApkDto,
  ) {
    return toAndroidApplicationResponse(this.lifecycle.updateApk(id, dto));
  }
}
