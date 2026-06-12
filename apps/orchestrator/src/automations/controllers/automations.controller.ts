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
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  AutomationDto,
  AutomationsGridPageDto,
  AutomationYamlDraftDto,
  AutomationValidationDto,
  CreateAutomationDto,
  DraftAutomationYamlDto,
  ListAutomationsGridQueryDto,
  UpdateAutomationDto,
  ValidateAutomationYamlDto,
} from '../dto/automation.dto';
import { AutomationCommandDto } from '../dto/automation-command.dto';
import {
  AutomationRunDto,
  AutomationRunEventDto,
  AutomationRunEventStreamTokenDto,
  ListAutomationRunsQueryDto,
  RunAdHocAiAutomationDto,
  RunAutomationDto,
} from '../dto/automation-run.dto';
import {
  AutomationTriggerDto,
  AutomationTriggersGridPageDto,
  CreateAutomationTriggerDto,
  ListAutomationTriggersGridQueryDto,
  UpdateAutomationTriggerDto,
} from '../dto/automation-trigger.dto';
import { AutomationsService } from '../services/automations.service';

@ApiTags('automations')
@Controller('automations')
export class AutomationsController {
  constructor(private readonly automations: AutomationsService) {}

  @Get('commands')
  @ApiOkResponse({ type: AutomationCommandDto, isArray: true })
  listCommands() {
    return this.automations.listCommands();
  }

  @Post('validate-yaml')
  @ApiOkResponse({ type: AutomationValidationDto })
  validateYaml(@Body() dto: ValidateAutomationYamlDto) {
    return this.automations.validateYaml(dto.yaml);
  }

  @Post('draft-yaml')
  @ApiCreatedResponse({ type: AutomationYamlDraftDto })
  draftYaml(@Body() dto: DraftAutomationYamlDto) {
    return this.automations.draftYaml(dto);
  }

  @Post('ai/runs')
  @ApiCreatedResponse({ type: AutomationRunDto })
  runAdHocAi(@Body() dto: RunAdHocAiAutomationDto) {
    return this.automations.runAdHocAi(dto);
  }

  @Get('ai/runs')
  @ApiOkResponse({ type: AutomationRunDto, isArray: true })
  listAdHocAiRuns(
    @Query('ownerUserId') ownerUserId: string,
    @Query('targetApplicationId') targetApplicationId: string,
    @Query('limit') limit?: string,
  ) {
    return this.automations.listAdHocAiRuns(
      ownerUserId,
      targetApplicationId,
      limit ? Number(limit) : undefined,
    );
  }

  @Delete('ai/runs')
  clearAdHocAiRuns(
    @Query('ownerUserId') ownerUserId: string,
    @Query('targetApplicationId') targetApplicationId: string,
  ) {
    return this.automations.clearAdHocAiRuns(ownerUserId, targetApplicationId);
  }

  @Get()
  @ApiOkResponse({ type: AutomationDto, isArray: true })
  list(@Query('ownerUserId') ownerUserId: string) {
    return this.automations.list(ownerUserId);
  }

  @Get('grid')
  @ApiOkResponse({ type: AutomationsGridPageDto })
  listGrid(@Query() query: ListAutomationsGridQueryDto) {
    return this.automations.listGrid(query);
  }

  @Get('runnable')
  @ApiOkResponse({ type: AutomationDto, isArray: true })
  listRunnable(@Query('ownerUserId') ownerUserId: string) {
    return this.automations.list(ownerUserId);
  }

  @Post()
  @ApiCreatedResponse({ type: AutomationDto })
  create(@Body() dto: CreateAutomationDto) {
    return this.automations.create(dto);
  }

  @Get('runs')
  @ApiOkResponse({ type: AutomationRunDto, isArray: true })
  listAllRuns(@Query() query: ListAutomationRunsQueryDto) {
    if (query.status === 'active') {
      return this.automations.listActiveRuns(query.ownerUserId);
    }
    return this.automations.listActiveRuns(query.ownerUserId);
  }

  @Get('runs/:runId')
  @ApiOkResponse({ type: AutomationRunDto })
  getRun(
    @Param('runId') runId: string,
    @Query('ownerUserId') ownerUserId: string,
  ) {
    return this.automations.getRun(ownerUserId, runId);
  }

  @Post('runs/:runId/cancel')
  @ApiOkResponse({ type: AutomationRunDto })
  cancelRun(
    @Param('runId') runId: string,
    @Query('ownerUserId') ownerUserId: string,
  ) {
    return this.automations.cancelRun(ownerUserId, runId);
  }

  @Get('runs/:runId/events')
  @ApiOkResponse({ type: AutomationRunEventDto, isArray: true })
  listRunEvents(
    @Param('runId') runId: string,
    @Query('ownerUserId') ownerUserId: string,
    @Query('after') after?: string,
  ) {
    return this.automations.listRunEvents(
      ownerUserId,
      runId,
      after === undefined ? undefined : Number(after),
    );
  }

  @Post('runs/:runId/events/token')
  @ApiCreatedResponse({ type: AutomationRunEventStreamTokenDto })
  createRunEventStreamToken(
    @Param('runId') runId: string,
    @Body() dto: Pick<RunAutomationDto, 'ownerUserId'>,
  ) {
    return this.automations.createRunEventStreamToken(dto.ownerUserId, runId);
  }

  @Get('triggers')
  @ApiOkResponse({ type: AutomationTriggerDto, isArray: true })
  listTriggers(@Query('ownerUserId') ownerUserId: string) {
    return this.automations.listTriggers(ownerUserId);
  }

  @Get('triggers/grid')
  @ApiOkResponse({ type: AutomationTriggersGridPageDto })
  listTriggersGrid(@Query() query: ListAutomationTriggersGridQueryDto) {
    return this.automations.listTriggersGrid(query);
  }

  @Post('triggers')
  @ApiCreatedResponse({ type: AutomationTriggerDto })
  createTrigger(@Body() dto: CreateAutomationTriggerDto) {
    return this.automations.createTrigger(dto);
  }

  @Get('triggers/:triggerId')
  @ApiOkResponse({ type: AutomationTriggerDto })
  getTrigger(
    @Param('triggerId') triggerId: string,
    @Query('ownerUserId') ownerUserId: string,
  ) {
    return this.automations.getTrigger(ownerUserId, triggerId);
  }

  @Patch('triggers/:triggerId')
  @ApiOkResponse({ type: AutomationTriggerDto })
  updateTrigger(
    @Param('triggerId') triggerId: string,
    @Query('ownerUserId') ownerUserId: string,
    @Body() dto: UpdateAutomationTriggerDto,
  ) {
    return this.automations.updateTrigger(ownerUserId, triggerId, dto);
  }

  @Delete('triggers/:triggerId')
  @ApiOkResponse({ type: AutomationTriggerDto })
  removeTrigger(
    @Param('triggerId') triggerId: string,
    @Query('ownerUserId') ownerUserId: string,
  ) {
    return this.automations.removeTrigger(ownerUserId, triggerId);
  }

  @Post('triggers/:triggerId/runs')
  @ApiCreatedResponse({ type: AutomationRunDto })
  runTrigger(
    @Param('triggerId') triggerId: string,
    @Body() dto: RunAutomationDto,
  ) {
    return this.automations.runTrigger(dto.ownerUserId, triggerId);
  }

  @Get(':id')
  @ApiOkResponse({ type: AutomationDto })
  get(@Param('id') id: string, @Query('ownerUserId') ownerUserId: string) {
    return this.automations.get(ownerUserId, id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: AutomationDto })
  update(
    @Param('id') id: string,
    @Query('ownerUserId') ownerUserId: string,
    @Body() dto: UpdateAutomationDto,
  ) {
    return this.automations.update(ownerUserId, id, dto);
  }

  @Delete(':id')
  @ApiOkResponse({ type: AutomationDto })
  remove(@Param('id') id: string, @Query('ownerUserId') ownerUserId: string) {
    return this.automations.remove(ownerUserId, id);
  }

  @Post(':id/runs')
  @ApiCreatedResponse({ type: AutomationRunDto })
  run(@Param('id') id: string, @Body() dto: RunAutomationDto) {
    return this.automations.run(dto.ownerUserId, id, dto);
  }

  @Get(':id/runs')
  @ApiOkResponse({ type: AutomationRunDto, isArray: true })
  listRuns(
    @Param('id') id: string,
    @Query() query: ListAutomationRunsQueryDto,
  ) {
    return this.automations.listRuns(query.ownerUserId, id, query.limit);
  }
}
