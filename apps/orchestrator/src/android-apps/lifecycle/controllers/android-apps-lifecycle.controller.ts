import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApplicationCommandResultDto } from '../../common/dto/application-command-result.dto';
import {
  ApiOpenAppQuota,
  OpenAppQuota,
} from '../../common/controllers/open-app-quota-header';
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

  @Delete(':id/lifecycle/profiles/:profileName')
  @ApiOperation({
    summary: 'Delete a saved persistent runtime profile and its data volume.',
  })
  @ApiOkResponse({ type: ApplicationCommandResultDto })
  async deleteSavedProfile(
    @Param('id') id: string,
    @Param('profileName') profileName: string,
  ) {
    return ApplicationCommandResultDto.fromEntity(
      await this.lifecycle.deleteSavedProfile(id, profileName),
    );
  }

  @Post(':id/lifecycle/start')
  @ApiOpenAppQuota()
  @ApiOperation({
    summary:
      'Start the application container, optionally selecting a runtime profile.',
  })
  @ApiOkResponse({ type: ApplicationCommandResultDto })
  async start(
    @Param('id') id: string,
    @Body() dto: StartAndroidApplicationDto,
    @OpenAppQuota() maxOpenApps?: number,
  ) {
    return ApplicationCommandResultDto.fromEntity(
      await this.lifecycle.start(id, dto, maxOpenApps),
    );
  }

  @Post(':id/lifecycle/stop')
  @ApiOkResponse({ type: ApplicationCommandResultDto })
  async stop(@Param('id') id: string) {
    return ApplicationCommandResultDto.fromEntity(
      await this.lifecycle.stop(id),
    );
  }

  @Post(':id/lifecycle/recreate')
  @ApiOpenAppQuota()
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Replace a stopped or errored application runtime and start it with its active profile.',
  })
  @ApiOkResponse({ type: ApplicationCommandResultDto })
  @ApiConflictResponse({
    description:
      'The app has active lifecycle work, is still running, or requires the Firewall feature.',
  })
  async recreate(
    @Param('id') id: string,
    @OpenAppQuota() maxOpenApps?: number,
  ) {
    return ApplicationCommandResultDto.fromEntity(
      await this.lifecycle.recreate(id, maxOpenApps),
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
