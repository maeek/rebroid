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
  AutomationCommandDto,
  AutomationDto,
  AutomationRunDto,
  AutomationTriggerDto,
  AutomationValidationDto,
  CreateAutomationDto,
  CreateAutomationTriggerDto,
  ListAutomationRunsQueryDto,
  RunAutomationDto,
  UpdateAutomationTriggerDto,
  UpdateAutomationDto,
  ValidateAutomationYamlDto,
} from '../dto/automation.dto';
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

  @Get()
  @ApiOkResponse({ type: AutomationDto, isArray: true })
  list(@Query('ownerUserId') ownerUserId: string) {
    return this.automations.list(ownerUserId);
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

  @Get('triggers')
  @ApiOkResponse({ type: AutomationTriggerDto, isArray: true })
  listTriggers(@Query('ownerUserId') ownerUserId: string) {
    return this.automations.listTriggers(ownerUserId);
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
