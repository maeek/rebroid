import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AndroidApplication } from './android-application.entity';
import { AndroidAppsService } from './android-apps.service';
import { AndroidNotificationDto } from './dto/android-notification.dto';
import { CreateAndroidApplicationDto } from './dto/create-android-application.dto';
import { DeleteAndroidApplicationResponseDto } from './dto/delete-android-application-response.dto';
import { ListAndroidApplicationsDto } from './dto/list-android-applications.dto';
import { RemoveAndroidApplicationDto } from './dto/remove-android-application.dto';
import { ScrcpySessionDto } from './dto/scrcpy-session.dto';
import { StartAndroidApplicationDto } from './dto/start-android-application.dto';
import { SwitchApplicationProfileDto } from './dto/switch-application-profile.dto';
import { UpdateAndroidApplicationApkDto } from './dto/update-android-application-apk.dto';
import { UpdateAndroidApplicationDto } from './dto/update-android-application.dto';
import { UpdateNetworkPolicyDto } from './dto/update-network-policy.dto';

@ApiTags('android-applications')
@Controller('android-applications')
export class AndroidAppsController {
  constructor(private readonly androidApps: AndroidAppsService) {}

  @Post()
  @ApiOperation({ summary: 'Provision an isolated redroid application container.' })
  @ApiCreatedResponse({ type: AndroidApplication })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', example: 'Signal Android' },
        ownerUserId: { type: 'string', example: 'user_123' },
        redroidImage: { type: 'string', example: 'redroid/redroid:13.0.0-latest' },
        inactivityTimeoutSeconds: { type: 'integer', example: 900 },
        memoryLimitMb: { type: 'integer', example: 2048 },
        cpuLimitCpus: { type: 'number', example: 2 },
        volumeSizeLimitMb: { type: 'integer', example: 8192 },
        redroidArgs: {
          type: 'string',
          example: 'androidboot.redroid_dpi=480 androidboot.redroid_width=1080',
        },
        uploadedApkId: { type: 'string', example: '98a530d6-a45d-466a-9cb4-c023067c4971' },
      },
    },
  })
  create(@Body() dto: CreateAndroidApplicationDto) {
    return this.androidApps.create(dto);
  }

  @Get()
  @ApiOkResponse({ type: AndroidApplication, isArray: true })
  list(@Query() query: ListAndroidApplicationsDto) {
    return this.androidApps.list(query);
  }

  @Get(':id')
  @ApiOkResponse({ type: AndroidApplication })
  get(@Param('id') id: string) {
    return this.androidApps.get(id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: AndroidApplication })
  update(@Param('id') id: string, @Body() dto: UpdateAndroidApplicationDto) {
    return this.androidApps.update(id, dto);
  }

  @Patch(':id/network-policy')
  @ApiOperation({ summary: 'Update and reconcile the app container egress allowlist.' })
  @ApiOkResponse({ type: AndroidApplication })
  updateNetworkPolicy(@Param('id') id: string, @Body() dto: UpdateNetworkPolicyDto) {
    return this.androidApps.updateNetworkPolicy(id, dto);
  }

  @Post(':id/network-policy/apply')
  @ApiOperation({ summary: 'Re-apply the stored network policy without restarting the container.' })
  @ApiOkResponse({ type: AndroidApplication })
  applyNetworkPolicy(@Param('id') id: string) {
    return this.androidApps.applyNetworkPolicy(id);
  }

  @Post(':id/profile')
  @ApiOperation({ summary: 'Select the runtime profile volume used by the next container start.' })
  @ApiOkResponse({ type: AndroidApplication })
  switchProfile(@Param('id') id: string, @Body() dto: SwitchApplicationProfileDto) {
    return this.androidApps.switchProfile(id, dto);
  }

  @Post(':id/start')
  @ApiOperation({ summary: 'Start the application container, optionally selecting a runtime profile.' })
  @ApiOkResponse({ type: AndroidApplication })
  start(@Param('id') id: string, @Body() dto: StartAndroidApplicationDto) {
    return this.androidApps.start(id, dto);
  }

  @Post(':id/stop')
  @ApiOkResponse({ type: AndroidApplication })
  stop(@Param('id') id: string) {
    return this.androidApps.stop(id);
  }

  @Put(':id/apk')
  @ApiOkResponse({ type: AndroidApplication })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['uploadedApkId'],
      properties: {
        uploadedApkId: { type: 'string', example: '98a530d6-a45d-466a-9cb4-c023067c4971' },
      },
    },
  })
  updateApk(@Param('id') id: string, @Body() dto: UpdateAndroidApplicationApkDto) {
    return this.androidApps.updateApk(id, dto);
  }

  @Get(':id/scrcpy-session')
  @ApiOkResponse({ type: ScrcpySessionDto })
  scrcpySession(@Param('id') id: string, @Headers('host') host?: string) {
    const baseUrl = host ? `ws://${host}` : undefined;
    return this.androidApps.scrcpySession(id, baseUrl);
  }

  @Get(':id/notifications')
  @ApiOkResponse({ type: AndroidNotificationDto, isArray: true })
  notifications(@Param('id') id: string) {
    return this.androidApps.notifications(id);
  }

  @Delete(':id')
  @ApiOkResponse({ type: DeleteAndroidApplicationResponseDto })
  remove(@Param('id') id: string, @Query() query: RemoveAndroidApplicationDto) {
    return this.androidApps.remove(id, query);
  }
}
