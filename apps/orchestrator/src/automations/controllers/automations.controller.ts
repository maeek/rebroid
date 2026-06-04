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
  AutomationValidationDto,
  CreateAutomationDto,
  ListAutomationRunsQueryDto,
  RunAutomationDto,
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

  @Post()
  @ApiCreatedResponse({ type: AutomationDto })
  create(@Body() dto: CreateAutomationDto) {
    return this.automations.create(dto);
  }

  @Get('runs/:runId')
  @ApiOkResponse({ type: AutomationRunDto })
  getRun(
    @Param('runId') runId: string,
    @Query('ownerUserId') ownerUserId: string,
  ) {
    return this.automations.getRun(ownerUserId, runId);
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
    return this.automations.run(dto.ownerUserId, id, dto.targetApplicationId);
  }

  @Get(':id/runs')
  @ApiOkResponse({ type: AutomationRunDto, isArray: true })
  listRuns(
    @Param('id') id: string,
    @Query('ownerUserId') ownerUserId: string,
    @Query() query: ListAutomationRunsQueryDto,
  ) {
    return this.automations.listRuns(ownerUserId, id, query.limit);
  }
}
