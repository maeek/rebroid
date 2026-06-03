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
import { AndroidApplicationResponseDto } from '../dto/android-application-response.dto';
import { AndroidApplicationSummaryResponseDto } from '../dto/android-application-summary-response.dto';
import { CloneAndroidApplicationDto } from '../dto/clone-android-application.dto';
import { CreateAndroidApplicationDto } from '../dto/create-android-application.dto';
import { DeleteAndroidApplicationResponseDto } from '../dto/delete-android-application-response.dto';
import { ListAndroidApplicationsDto } from '../dto/list-android-applications.dto';
import { RemoveAndroidApplicationDto } from '../dto/remove-android-application.dto';
import { UpdateAndroidApplicationDto } from '../dto/update-android-application.dto';
import { AndroidAppsLifecycleService } from '../../lifecycle/services/android-apps-lifecycle.service';
import { AndroidAppsStateService } from '../services/android-apps-state.service';
import {
  toAndroidApplicationResponse,
  toAndroidApplicationResponseList,
} from '../utils/android-apps-controller-response.utils';

@ApiTags('android-applications')
@Controller('android-applications')
export class AndroidAppsController {
  constructor(
    private readonly lifecycle: AndroidAppsLifecycleService,
    private readonly state: AndroidAppsStateService,
  ) {}

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
    return toAndroidApplicationResponse(this.lifecycle.create(dto));
  }

  @Post(':id/clone')
  @ApiOperation({
    summary:
      'Create a separate owner-scoped application from an existing app definition.',
  })
  @ApiCreatedResponse({ type: AndroidApplicationResponseDto })
  clone(@Param('id') id: string, @Body() dto: CloneAndroidApplicationDto) {
    return toAndroidApplicationResponse(this.lifecycle.clone(id, dto));
  }

  @Get()
  @ApiOkResponse({ type: AndroidApplicationResponseDto, isArray: true })
  list(@Query() query: ListAndroidApplicationsDto) {
    return toAndroidApplicationResponseList(this.state.list(query));
  }

  @Get('summaries')
  @ApiOperation({
    summary:
      'List lightweight app state for navigation and polling without Docker reconciliation.',
  })
  @ApiOkResponse({ type: AndroidApplicationSummaryResponseDto, isArray: true })
  async listSummaries(@Query() query: ListAndroidApplicationsDto) {
    return (await this.state.listSummaries(query)).map((app) =>
      AndroidApplicationSummaryResponseDto.fromEntity(app),
    );
  }

  @Get(':id')
  @ApiOkResponse({ type: AndroidApplicationResponseDto })
  get(@Param('id') id: string) {
    return toAndroidApplicationResponse(this.state.get(id));
  }

  @Patch(':id')
  @ApiOkResponse({ type: AndroidApplicationResponseDto })
  update(@Param('id') id: string, @Body() dto: UpdateAndroidApplicationDto) {
    return toAndroidApplicationResponse(this.lifecycle.update(id, dto));
  }

  @Delete(':id')
  @ApiOkResponse({ type: DeleteAndroidApplicationResponseDto })
  remove(@Param('id') id: string, @Query() query: RemoveAndroidApplicationDto) {
    return this.lifecycle.remove(id, query);
  }
}
