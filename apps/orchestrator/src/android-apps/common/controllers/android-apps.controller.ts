import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApplicationCommandResultDto } from '../dto/application-command-result.dto';
import { AndroidApplicationResponseDto } from '../dto/android-application-response.dto';
import {
  AndroidAppRuntimeReconciliationDto,
  ReconcileAndroidApplicationsDto,
} from '../dto/android-app-runtime-reconciliation.dto';
import { AndroidApplicationSummaryResponseDto } from '../dto/android-application-summary-response.dto';
import { CloneAndroidApplicationDto } from '../dto/clone-android-application.dto';
import { CreateAndroidApplicationDto } from '../dto/create-android-application.dto';
import { DeleteAndroidApplicationResponseDto } from '../dto/delete-android-application-response.dto';
import { ListAndroidApplicationsDto } from '../dto/list-android-applications.dto';
import { RemoveAndroidApplicationDto } from '../dto/remove-android-application.dto';
import { UpdateAndroidApplicationDto } from '../dto/update-android-application.dto';
import { AndroidAppsLifecycleService } from '../../lifecycle/services/android-apps-lifecycle.service';
import { AndroidAppsQueryService } from '../services/android-apps-query.service';
import { AndroidAppsRuntimeStateReconciler } from '../services/android-apps-runtime-state-reconciler.service';

@ApiTags('apps')
@Controller('apps')
export class AndroidAppsController {
  constructor(
    private readonly lifecycle: AndroidAppsLifecycleService,
    private readonly queries: AndroidAppsQueryService,
    private readonly reconciler: AndroidAppsRuntimeStateReconciler,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Provision an isolated application container.',
  })
  @ApiCreatedResponse({ type: ApplicationCommandResultDto })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', example: 'Signal Android' },
        ownerUserId: { type: 'string', example: 'user_123' },
        containerImage: {
          type: 'string',
          example: 'redroid/redroid:14.0.0-latest',
        },
        inactivityTimeoutSeconds: { type: 'integer', example: 900 },
        memoryLimitMb: { type: 'integer', example: 2048 },
        cpuLimitCpus: { type: 'number', example: 2 },
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
  async create(@Body() dto: CreateAndroidApplicationDto) {
    return ApplicationCommandResultDto.fromEntity(
      await this.lifecycle.create(dto),
    );
  }

  @Post(':id/clone')
  @ApiOperation({
    summary:
      'Create a separate owner-scoped application from an existing app definition.',
  })
  @ApiCreatedResponse({ type: ApplicationCommandResultDto })
  async clone(
    @Param('id') id: string,
    @Body() dto: CloneAndroidApplicationDto,
  ) {
    return ApplicationCommandResultDto.fromEntity(
      await this.lifecycle.clone(id, dto),
    );
  }

  @Get()
  @ApiOkResponse({ type: AndroidApplicationResponseDto, isArray: true })
  async list(@Query() query: ListAndroidApplicationsDto) {
    return (await this.queries.listStored(query)).map((app) =>
      AndroidApplicationResponseDto.fromEntity(app),
    );
  }

  @Get('summaries')
  @ApiOperation({
    summary:
      'List lightweight app state for navigation and polling without Docker reconciliation.',
  })
  @ApiOkResponse({ type: AndroidApplicationSummaryResponseDto, isArray: true })
  async listSummaries(@Query() query: ListAndroidApplicationsDto) {
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

  @Get(':id')
  @ApiOkResponse({ type: AndroidApplicationResponseDto })
  async get(@Param('id') id: string) {
    return AndroidApplicationResponseDto.fromEntity(
      await this.queries.getStored(id),
    );
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
