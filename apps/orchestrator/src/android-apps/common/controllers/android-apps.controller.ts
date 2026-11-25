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
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApplicationCommandResultDto } from '../dto/application-command-result.dto';
import {
  AndroidApplicationGalleryRowDto,
  AndroidApplicationNavigationRowDto,
} from '../dto/android-application-catalog-row.dto';
import { ListAndroidApplicationNavigationDto } from '../dto/list-android-application-navigation.dto';
import {
  AndroidApplicationDetailRefreshDto,
  AndroidApplicationResponseDto,
} from '../dto/android-application-response.dto';
import { AndroidDeviceViewerTargetDto } from '../dto/android-application-viewer-runtime.dto';
import {
  AndroidAppRuntimeReconciliationDto,
  ReconcileAndroidApplicationsDto,
} from '../dto/android-app-runtime-reconciliation.dto';
import { AndroidApplicationSummaryResponseDto } from '../dto/android-application-summary-response.dto';
import { CloneAndroidApplicationDto } from '../dto/clone-android-application.dto';
import { CreateManagedAndroidDeviceDto } from '../dto/create-android-application.dto';
import { DeleteAndroidApplicationResponseDto } from '../dto/delete-android-application-response.dto';
import { ListAndroidApplicationSummariesDto } from '../dto/list-android-application-summaries.dto';
import { ListAndroidApplicationsDto } from '../dto/list-android-applications.dto';
import { RemoveAndroidApplicationDto } from '../dto/remove-android-application.dto';
import { UpdateAndroidApplicationDto } from '../dto/update-android-application.dto';
import { AndroidAppsLifecycleService } from '../../lifecycle/services/android-apps-lifecycle.service';
import { AndroidAppsQueryService } from '../services/android-apps-query.service';
import { AndroidAppsRuntimeStateReconciler } from '../services/android-apps-runtime-state-reconciler.service';
import { ApiOpenAppQuota, OpenAppQuota } from './open-app-quota-header';
import { ApiImageAccess, ImageAccess } from './application-image-access-header';
import type { ApplicationImageAccess } from '../../lifecycle/utils/application-image-access';

@ApiTags('devices')
@Controller('devices')
export class AndroidAppsController {
  constructor(
    private readonly lifecycle: AndroidAppsLifecycleService,
    private readonly queries: AndroidAppsQueryService,
    private readonly reconciler: AndroidAppsRuntimeStateReconciler,
  ) {}

  @Post()
  @ApiOpenAppQuota()
  @ApiImageAccess()
  @ApiOperation({
    summary: 'Provision a managed Android device.',
  })
  @ApiCreatedResponse({ type: ApplicationCommandResultDto })
  @ApiBadRequestResponse({
    description: 'The request contains invalid fields.',
    schema: {
      type: 'object',
      required: ['statusCode', 'message', 'fields'],
      properties: {
        statusCode: { type: 'integer', example: 400 },
        message: { type: 'array', items: { type: 'string' } },
        fields: { type: 'array', items: { type: 'string' }, example: ['name'] },
      },
    },
  })
  @ApiServiceUnavailableResponse({
    description:
      'The container engine could not be reached during image inspection.',
    schema: {
      type: 'object',
      required: ['statusCode', 'code', 'message'],
      properties: {
        statusCode: { type: 'integer', example: 503 },
        code: { type: 'string', example: 'container_engine_unavailable' },
        message: { type: 'string' },
      },
    },
  })
  @ApiConflictResponse({
    description:
      'The open-app limit is reached or the uploaded APK or required Firewall feature is unavailable.',
    schema: {
      type: 'object',
      required: ['statusCode', 'code', 'message'],
      properties: {
        statusCode: { type: 'integer', example: 409 },
        code: {
          type: 'string',
          enum: [
            'apk_unavailable',
            'feature_disabled',
            'feature_unsupported',
            'open_app_quota_exceeded',
          ],
        },
        message: { type: 'string' },
      },
    },
  })
  @ApiBody({ type: CreateManagedAndroidDeviceDto })
  async create(
    @Body() dto: CreateManagedAndroidDeviceDto,
    @OpenAppQuota() maxOpenApps?: number,
    @ImageAccess() imageAccess?: ApplicationImageAccess,
  ) {
    return ApplicationCommandResultDto.fromEntity(
      await this.lifecycle.create(dto, maxOpenApps, imageAccess),
    );
  }

  @Post(':id/clone')
  @ApiOpenAppQuota()
  @ApiImageAccess()
  @ApiOperation({
    summary:
      'Create a separate owner-scoped application from an existing app definition.',
  })
  @ApiCreatedResponse({ type: ApplicationCommandResultDto })
  async clone(
    @Param('id') id: string,
    @Body() dto: CloneAndroidApplicationDto,
    @OpenAppQuota() maxOpenApps?: number,
    @ImageAccess() imageAccess?: ApplicationImageAccess,
  ) {
    return ApplicationCommandResultDto.fromEntity(
      await this.lifecycle.clone(id, dto, maxOpenApps, imageAccess),
    );
  }

  @Get()
  @ApiOkResponse({ type: AndroidApplicationResponseDto, isArray: true })
  async list(@Query() query: ListAndroidApplicationsDto) {
    return (await this.queries.listStored(query)).map((app) =>
      AndroidApplicationResponseDto.fromEntity(app),
    );
  }

  @Get('gallery')
  @ApiOkResponse({ type: AndroidApplicationGalleryRowDto, isArray: true })
  async listGallery(@Query() query: ListAndroidApplicationsDto) {
    return (await this.queries.listGallery(query)).map((app) =>
      AndroidApplicationGalleryRowDto.fromEntity(app),
    );
  }

  @Post('navigation')
  @HttpCode(200)
  @ApiOkResponse({ type: AndroidApplicationNavigationRowDto, isArray: true })
  async listNavigation(@Body() query: ListAndroidApplicationNavigationDto) {
    return (await this.queries.listNavigation(query)).map((app) =>
      AndroidApplicationNavigationRowDto.fromEntity(app),
    );
  }

  @Get('summaries')
  @ApiOperation({
    summary:
      'List lightweight app state for navigation and polling without Docker reconciliation.',
  })
  @ApiOkResponse({ type: AndroidApplicationSummaryResponseDto, isArray: true })
  async listSummaries(@Query() query: ListAndroidApplicationSummariesDto) {
    return (await this.queries.listSummaries(query)).map((app) =>
      AndroidApplicationSummaryResponseDto.fromEntity(app),
    );
  }

  @Post('runtime-state/reconcile')
  @ApiOperation({
    summary: 'Refresh stored application state from managed containers.',
  })
  @ApiOkResponse({ type: AndroidAppRuntimeReconciliationDto, isArray: true })
  async reconcileMany(@Body() dto: ReconcileAndroidApplicationsDto) {
    const results = await this.reconciler.reconcileManyWithResults(dto);
    return results.map((result) =>
      AndroidAppRuntimeReconciliationDto.fromResult(result),
    );
  }

  @Post(':id/runtime-state/reconcile')
  @ApiOperation({ summary: 'Refresh one application state from Docker.' })
  @ApiOkResponse({ type: AndroidAppRuntimeReconciliationDto })
  async reconcileOne(@Param('id') id: string) {
    return AndroidAppRuntimeReconciliationDto.fromResult(
      await this.reconciler.reconcileResultById(id),
    );
  }

  @Get(':id/viewer-runtime')
  @ApiOkResponse({ type: AndroidDeviceViewerTargetDto })
  async getViewerRuntime(
    @Param('id') id: string,
  ): Promise<AndroidDeviceViewerTargetDto> {
    return AndroidDeviceViewerTargetDto.fromRuntime(
      await this.queries.getViewerRuntime(id),
    );
  }

  @Get(':id/detail')
  @ApiQuery({ name: 'revision', type: String, required: false })
  @ApiOkResponse({ type: AndroidApplicationDetailRefreshDto })
  refreshDetail(@Param('id') id: string, @Query('revision') known?: string) {
    return this.queries.refreshDetail(id, known);
  }

  @Get(':id')
  @ApiOkResponse({ type: AndroidApplicationResponseDto })
  get(@Param('id') id: string) {
    return this.queries.getDetail(id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: ApplicationCommandResultDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAndroidApplicationDto,
  ) {
    return ApplicationCommandResultDto.fromEntity(
      await this.lifecycle.update(id, dto),
    );
  }

  @Delete(':id')
  @ApiOkResponse({ type: DeleteAndroidApplicationResponseDto })
  remove(@Param('id') id: string, @Query() query: RemoveAndroidApplicationDto) {
    return this.lifecycle.remove(id, query);
  }
}
