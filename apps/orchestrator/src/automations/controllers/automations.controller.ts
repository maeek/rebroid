import { RequiresFeature } from '../../feature-flags/feature-flags.guard';
import { once } from 'node:events';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import {
  AutomationDto,
  AutomationsGridPageDto,
  AutomationValidationDto,
  CreateAutomationDto,
  DraftAutomationYamlDto,
  ListAutomationsGridQueryDto,
  UpdateAutomationDto,
  ValidateAutomationYamlDto,
} from '../dto/automation.dto';
import { AutomationCommandDto } from '../dto/automation-command.dto';
import {
  ApplicationWorkflowRunDto,
  ApplicationWorkflowRunPageDto,
  ApplicationWorkflowScopeDto,
  ListApplicationWorkflowRunsDto,
} from '../dto/application-workflow-history.dto';
import {
  AiPromptSuggestionsDto,
  RunAdHocAiAutomationDto,
  SuggestAdHocAiPromptsDto,
} from '../dto/automation-ai-run.dto';
import {
  AutomationRunEventDto,
  AutomationRunEventStreamTokenDto,
} from '../dto/automation-run-event.dto';
import {
  AutomationRunDto,
  AutomationAiRunHistoryDto,
  ListActiveAutomationRunsQueryDto,
  ListAutomationRunsQueryDto,
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

  @RequiresFeature('feature.workflows')
  @Post('validate-yaml')
  @ApiOkResponse({ type: AutomationValidationDto })
  validateYaml(@Body() dto: ValidateAutomationYamlDto) {
    return this.automations.validateYaml(dto.yaml);
  }

  @RequiresFeature('feature.ai', 'feature.workflows')
  @Post('draft-yaml/stream')
  @ApiOkResponse({
    description: 'Server-sent draft generation events.',
  })
  async draftYamlStream(
    @Body() dto: DraftAutomationYamlDto,
    @Res() reply: FastifyReply,
  ) {
    const abortController = new AbortController();
    const close = () => abortController.abort();
    reply.raw.once('close', close);
    const requestId = reply.getHeader('x-request-id');
    reply.hijack();
    reply.raw.writeHead(200, {
      ...(typeof requestId === 'string' ? { 'x-request-id': requestId } : {}),
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store',
    });
    try {
      for await (const event of this.automations.draftYamlEvents(
        dto,
        abortController.signal,
      )) {
        if (reply.raw.destroyed) break;
        if (!reply.raw.write(sseEvent(event.type, event))) {
          await once(reply.raw, 'drain', { signal: abortController.signal });
        }
      }
      if (!reply.raw.destroyed) reply.raw.end();
    } catch (error) {
      if (!abortController.signal.aborted)
        reply.raw.destroy(error instanceof Error ? error : undefined);
    } finally {
      reply.raw.off('close', close);
      close();
    }
  }

  @RequiresFeature('feature.ai')
  @Post('ai/runs')
  @ApiCreatedResponse({ type: AutomationRunDto })
  runAdHocAi(@Body() dto: RunAdHocAiAutomationDto) {
    return this.automations.runAdHocAi(dto);
  }

  @RequiresFeature('feature.ai')
  @Post('ai/suggestions')
  @ApiOkResponse({ type: AiPromptSuggestionsDto })
  suggestAdHocAiPrompts(@Body() dto: SuggestAdHocAiPromptsDto) {
    return this.automations.suggestAdHocAiPrompts(dto);
  }

  @RequiresFeature('feature.ai')
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

  @RequiresFeature('feature.ai')
  @Get('ai/run-history')
  @ApiQuery({ name: 'limit', required: false, type: String })
  @ApiOkResponse({ type: AutomationAiRunHistoryDto, isArray: true })
  listAdHocAiRunHistory(
    @Query('ownerUserId') ownerUserId: string,
    @Query('targetApplicationId') targetApplicationId: string,
    @Query('limit') limit?: string,
  ) {
    return this.automations.listAdHocAiRunHistory(
      ownerUserId,
      targetApplicationId,
      limit ? Number(limit) : undefined,
    );
  }

  @RequiresFeature('feature.ai')
  @Delete('ai/runs')
  clearAdHocAiRuns(
    @Query('ownerUserId') ownerUserId: string,
    @Query('targetApplicationId') targetApplicationId: string,
  ) {
    return this.automations.clearAdHocAiRuns(ownerUserId, targetApplicationId);
  }

  @RequiresFeature('feature.workflows')
  @Get()
  @ApiOkResponse({ type: AutomationDto, isArray: true })
  list(@Query('ownerUserId') ownerUserId: string) {
    return this.automations.list(ownerUserId);
  }

  @RequiresFeature('feature.workflows')
  @Get('grid')
  @ApiOkResponse({ type: AutomationsGridPageDto })
  listGrid(@Query() query: ListAutomationsGridQueryDto) {
    return this.automations.listGrid(query);
  }

  @RequiresFeature('feature.workflows')
  @Get('runnable')
  @ApiOkResponse({ type: AutomationDto, isArray: true })
  listRunnable(@Query('ownerUserId') ownerUserId: string) {
    return this.automations.list(ownerUserId);
  }

  @RequiresFeature('feature.workflows')
  @Post()
  @ApiCreatedResponse({ type: AutomationDto })
  create(@Body() dto: CreateAutomationDto) {
    return this.automations.create(dto);
  }

  @Get('runs/active')
  @ApiOkResponse({ type: AutomationRunDto, isArray: true })
  listActiveRuns(@Query() query: ListActiveAutomationRunsQueryDto) {
    return this.automations.listActiveRuns(query.ownerUserId);
  }

  @RequiresFeature('feature.workflows')
  @Get('runs/history')
  @ApiOkResponse({ type: ApplicationWorkflowRunPageDto })
  listApplicationWorkflowRuns(@Query() query: ListApplicationWorkflowRunsDto) {
    return this.automations.listApplicationWorkflowRuns(query);
  }

  @RequiresFeature('feature.workflows')
  @Get('runs/history/:runId')
  @ApiOkResponse({ type: ApplicationWorkflowRunDto })
  getApplicationWorkflowRun(
    @Query() query: ApplicationWorkflowScopeDto,
    @Param('runId', ParseUUIDPipe) runId: string,
  ) {
    return this.automations.getApplicationWorkflowRun(
      query.ownerUserId,
      query.targetApplicationId,
      runId,
    );
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
  @ApiQuery({ name: 'view', required: false, enum: ['conversation'] })
  @ApiOkResponse({ type: AutomationRunEventDto, isArray: true })
  listRunEvents(
    @Param('runId') runId: string,
    @Query('ownerUserId') ownerUserId: string,
    @Query('after') after?: string,
    @Query('view') view?: string,
  ) {
    return this.automations.listRunEvents(
      ownerUserId,
      runId,
      after === undefined ? undefined : Number(after),
      view,
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

  @RequiresFeature('feature.workflows')
  @Get('triggers')
  @ApiOkResponse({ type: AutomationTriggerDto, isArray: true })
  listTriggers(@Query('ownerUserId') ownerUserId: string) {
    return this.automations.listTriggers(ownerUserId);
  }

  @RequiresFeature('feature.workflows')
  @Get('triggers/grid')
  @ApiOkResponse({ type: AutomationTriggersGridPageDto })
  listTriggersGrid(@Query() query: ListAutomationTriggersGridQueryDto) {
    return this.automations.listTriggersGrid(query);
  }

  @RequiresFeature('feature.workflows')
  @Post('triggers')
  @ApiCreatedResponse({ type: AutomationTriggerDto })
  createTrigger(@Body() dto: CreateAutomationTriggerDto) {
    return this.automations.createTrigger(dto);
  }

  @RequiresFeature('feature.workflows')
  @Get('triggers/:triggerId')
  @ApiOkResponse({ type: AutomationTriggerDto })
  getTrigger(
    @Param('triggerId') triggerId: string,
    @Query('ownerUserId') ownerUserId: string,
  ) {
    return this.automations.getTrigger(ownerUserId, triggerId);
  }

  @RequiresFeature('feature.workflows')
  @Patch('triggers/:triggerId')
  @ApiOkResponse({ type: AutomationTriggerDto })
  updateTrigger(
    @Param('triggerId') triggerId: string,
    @Query('ownerUserId') ownerUserId: string,
    @Body() dto: UpdateAutomationTriggerDto,
  ) {
    return this.automations.updateTrigger(ownerUserId, triggerId, dto);
  }

  @RequiresFeature('feature.workflows')
  @Delete('triggers/:triggerId')
  @ApiOkResponse({ type: AutomationTriggerDto })
  removeTrigger(
    @Param('triggerId') triggerId: string,
    @Query('ownerUserId') ownerUserId: string,
  ) {
    return this.automations.removeTrigger(ownerUserId, triggerId);
  }

  @RequiresFeature('feature.workflows')
  @Post('triggers/:triggerId/runs')
  @ApiCreatedResponse({ type: AutomationRunDto })
  runTrigger(
    @Param('triggerId') triggerId: string,
    @Body() dto: RunAutomationDto,
  ) {
    return this.automations.runTrigger(dto.ownerUserId, triggerId);
  }

  @RequiresFeature('feature.workflows')
  @Get(':id')
  @ApiOkResponse({ type: AutomationDto })
  get(@Param('id') id: string, @Query('ownerUserId') ownerUserId: string) {
    return this.automations.get(ownerUserId, id);
  }

  @RequiresFeature('feature.workflows')
  @Patch(':id')
  @ApiOkResponse({ type: AutomationDto })
  update(
    @Param('id') id: string,
    @Query('ownerUserId') ownerUserId: string,
    @Body() dto: UpdateAutomationDto,
  ) {
    return this.automations.update(ownerUserId, id, dto);
  }

  @RequiresFeature('feature.workflows')
  @Delete(':id')
  @ApiOkResponse({ type: AutomationDto })
  remove(@Param('id') id: string, @Query('ownerUserId') ownerUserId: string) {
    return this.automations.remove(ownerUserId, id);
  }

  @RequiresFeature('feature.workflows')
  @Post(':id/runs')
  @ApiCreatedResponse({ type: AutomationRunDto })
  run(@Param('id') id: string, @Body() dto: RunAutomationDto) {
    return this.automations.run(dto.ownerUserId, id, dto);
  }

  @RequiresFeature('feature.workflows')
  @Get(':id/runs')
  @ApiOkResponse({ type: AutomationRunDto, isArray: true })
  listRuns(
    @Param('id') id: string,
    @Query() query: ListAutomationRunsQueryDto,
  ) {
    return this.automations.listRuns(query.ownerUserId, id, query.limit);
  }
}

const sseEvent = (eventName: string, payload: unknown) =>
  `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
