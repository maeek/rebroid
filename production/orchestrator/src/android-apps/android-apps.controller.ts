import {
  Body,
  Controller,
  Delete,
  Get,
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
import { AndroidApplicationResponseDto } from './dto/android-application-response.dto';
import { ApplicationLogDto } from './dto/application-log.dto';
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
  @ApiOperation({
    summary: 'Provision an isolated application container.',
  })
  @ApiCreatedResponse({ type: AndroidApplicationResponseDto })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', example: 'Signal Android' },
        ownerUserId: { type: 'string', example: 'user_123' },
        containerImage: {
          type: 'string',
          example: 'redroid/redroid:13.0.0-latest',
        },
        inactivityTimeoutSeconds: { type: 'integer', example: 900 },
        memoryLimitMb: { type: 'integer', example: 2048 },
        cpuLimitCpus: { type: 'number', example: 2 },
        volumeSizeLimitMb: { type: 'integer', example: 8192 },
        containerArgs: {
          type: 'string',
          example: 'sleep infinity',
        },
        uploadedApkId: {
          type: 'string',
          example: '98a530d6-a45d-466a-9cb4-c023067c4971',
        },
      },
    },
  })
  create(@Body() dto: CreateAndroidApplicationDto) {
    return this.toResponse(this.androidApps.create(dto));
  }

  @Get()
  @ApiOkResponse({ type: AndroidApplicationResponseDto, isArray: true })
  list(@Query() query: ListAndroidApplicationsDto) {
    return this.toResponseList(this.androidApps.list(query));
  }

  @Get(':id')
  @ApiOkResponse({ type: AndroidApplicationResponseDto })
  get(@Param('id') id: string) {
    return this.toResponse(this.androidApps.get(id));
  }

  @Patch(':id')
  @ApiOkResponse({ type: AndroidApplicationResponseDto })
  update(@Param('id') id: string, @Body() dto: UpdateAndroidApplicationDto) {
    return this.toResponse(this.androidApps.update(id, dto));
  }

  @Patch(':id/network-policy')
  @ApiOperation({
    summary: 'Update and reconcile the app container egress allowlist.',
  })
  @ApiOkResponse({ type: AndroidApplicationResponseDto })
  updateNetworkPolicy(
    @Param('id') id: string,
    @Body() dto: UpdateNetworkPolicyDto,
  ) {
    return this.toResponse(this.androidApps.updateNetworkPolicy(id, dto));
  }

  @Post(':id/network-policy/apply')
  @ApiOperation({
    summary:
      'Re-apply the stored network policy without restarting the container.',
  })
  @ApiOkResponse({ type: AndroidApplicationResponseDto })
  applyNetworkPolicy(@Param('id') id: string) {
    return this.toResponse(this.androidApps.applyNetworkPolicy(id));
  }

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
    return this.toResponse(this.androidApps.switchProfile(id, dto));
  }

  @Post(':id/start')
  @ApiOperation({
    summary:
      'Start the application container, optionally selecting a runtime profile.',
  })
  @ApiOkResponse({ type: AndroidApplicationResponseDto })
  start(@Param('id') id: string, @Body() dto: StartAndroidApplicationDto) {
    return this.toResponse(this.androidApps.start(id, dto));
  }

  @Post(':id/stop')
  @ApiOkResponse({ type: AndroidApplicationResponseDto })
  stop(@Param('id') id: string) {
    return this.toResponse(this.androidApps.stop(id));
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
    return this.toResponse(this.androidApps.updateApk(id, dto));
  }

  @Get(':id/scrcpy-session')
  @ApiOkResponse({ type: ScrcpySessionDto })
  scrcpySession(@Param('id') id: string) {
    return this.androidApps.scrcpySession(id);
  }

  @Post(':id/viewer-activity')
  @ApiOperation({
    summary: 'Refresh viewer activity for inactivity timeout tracking.',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      required: ['id', 'lastScrcpyActivityAt'],
      properties: {
        id: { type: 'string' },
        lastScrcpyActivityAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  viewerActivity(@Param('id') id: string) {
    return this.androidApps.recordViewerActivity(id);
  }

  @Get(':id/notifications')
  @ApiOkResponse({ type: AndroidNotificationDto, isArray: true })
  notifications(@Param('id') id: string) {
    return this.androidApps.notifications(id);
  }

  @Get(':id/logs/container')
  @ApiOperation({
    summary: 'Read recent Docker container logs for an application.',
  })
  @ApiOkResponse({ type: ApplicationLogDto })
  containerLogs(@Param('id') id: string, @Query('tail') tail?: string) {
    return this.androidApps.containerLogs(id, tail ? Number(tail) : undefined);
  }

  @Get(':id/logs/adb')
  @ApiOperation({
    summary: 'Read recent Android logcat output for a running application.',
  })
  @ApiOkResponse({ type: ApplicationLogDto })
  adbLogs(@Param('id') id: string, @Query('tail') tail?: string) {
    return this.androidApps.adbLogs(id, tail ? Number(tail) : undefined);
  }

  @Delete(':id')
  @ApiOkResponse({ type: DeleteAndroidApplicationResponseDto })
  remove(@Param('id') id: string, @Query() query: RemoveAndroidApplicationDto) {
    return this.androidApps.remove(id, query);
  }

  private async toResponse(application: Promise<AndroidApplication>) {
    return AndroidApplicationResponseDto.fromEntity(await application);
  }

  private async toResponseList(applications: Promise<AndroidApplication[]>) {
    return (await applications).map((app) =>
      AndroidApplicationResponseDto.fromEntity(app),
    );
  }
}
