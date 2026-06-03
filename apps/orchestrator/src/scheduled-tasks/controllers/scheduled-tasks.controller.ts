import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  CreateScheduledTaskDto,
  ScheduledTaskActionDto,
  ScheduledTaskDto,
  UpdateScheduledTaskDto,
} from '../dto/scheduled-task.dto';
import { ScheduledTasksService } from '../services/scheduled-tasks.service';

@ApiTags('scheduled-tasks')
@Controller('scheduled-tasks')
export class ScheduledTasksController {
  constructor(private readonly tasks: ScheduledTasksService) {}

  @Get('actions')
  @ApiOkResponse({ type: ScheduledTaskActionDto, isArray: true })
  listActions() {
    return this.tasks.listActions();
  }

  @Get()
  @ApiOkResponse({ type: ScheduledTaskDto, isArray: true })
  list() {
    return this.tasks.list();
  }

  @Post()
  @ApiCreatedResponse({ type: ScheduledTaskDto })
  create(@Body() dto: CreateScheduledTaskDto) {
    return this.tasks.create(dto);
  }

  @Get(':id')
  @ApiOkResponse({ type: ScheduledTaskDto })
  get(@Param('id') id: string) {
    return this.tasks.get(id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: ScheduledTaskDto })
  update(@Param('id') id: string, @Body() dto: UpdateScheduledTaskDto) {
    return this.tasks.update(id, dto);
  }

  @Post(':id/run')
  @ApiOkResponse({ type: ScheduledTaskDto })
  runNow(@Param('id') id: string) {
    return this.tasks.runNow(id);
  }

  @Delete(':id')
  @ApiOkResponse({ type: ScheduledTaskDto })
  remove(@Param('id') id: string) {
    return this.tasks.remove(id);
  }
}
