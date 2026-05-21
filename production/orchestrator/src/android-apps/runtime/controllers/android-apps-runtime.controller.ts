import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AndroidNotificationDto } from '../dto/android-notification.dto';
import {
  ApplicationClipboardDto,
  UpdateApplicationClipboardDto,
} from '../dto/application-clipboard.dto';
import { ApplicationLogDto } from '../dto/application-log.dto';
import {
  ApplicationRuntimeFileDownloadDto,
  ApplicationRuntimeFileDto,
  ApplicationRuntimeFileUploadDto,
} from '../dto/application-runtime-file.dto';
import { ApplicationScreenshotDto } from '../dto/application-screenshot.dto';
import { AndroidAppsRuntimeAccessService } from '../services/android-apps-runtime-access.service';

@ApiTags('android-applications')
@Controller('android-applications')
export class AndroidAppsRuntimeController {
  constructor(private readonly runtime: AndroidAppsRuntimeAccessService) {}

  @Get(':id/notifications')
  @ApiOkResponse({ type: AndroidNotificationDto, isArray: true })
  notifications(@Param('id') id: string) {
    return this.runtime.notifications(id);
  }

  @Get(':id/files/downloads')
  @ApiOperation({
    summary: 'List files from the application Download directory.',
  })
  @ApiOkResponse({ type: ApplicationRuntimeFileDto, isArray: true })
  listDownloadFiles(@Param('id') id: string) {
    return this.runtime.listDownloadFiles(id);
  }

  @Post(':id/files/downloads')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Upload a file to the application Download directory.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOkResponse({ type: ApplicationRuntimeFileUploadDto })
  uploadDownloadFile(
    @Param('id') id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.runtime.uploadDownloadFile(id, file);
  }

  @Get(':id/files/downloads/:fileName')
  @ApiOperation({
    summary: 'Read a file from the application Download directory.',
  })
  @ApiOkResponse({ type: ApplicationRuntimeFileDownloadDto })
  downloadFile(@Param('id') id: string, @Param('fileName') fileName: string) {
    return this.runtime.downloadFile(id, fileName);
  }

  @Get(':id/clipboard')
  @ApiOperation({
    summary: 'Read the application clipboard when supported by the runtime.',
  })
  @ApiOkResponse({ type: ApplicationClipboardDto })
  getClipboard(@Param('id') id: string) {
    return this.runtime.getClipboard(id);
  }

  @Put(':id/clipboard')
  @ApiOperation({
    summary: 'Write the application clipboard when supported by the runtime.',
  })
  @ApiOkResponse({ type: ApplicationClipboardDto })
  setClipboard(
    @Param('id') id: string,
    @Body() dto: UpdateApplicationClipboardDto,
  ) {
    return this.runtime.setClipboard(id, dto.text);
  }

  @Post(':id/screenshot')
  @ApiOperation({
    summary: 'Capture a PNG screenshot from the application runtime.',
  })
  @ApiOkResponse({ type: ApplicationScreenshotDto })
  screenshot(@Param('id') id: string) {
    return this.runtime.screenshot(id);
  }

  @Get(':id/logs/container')
  @ApiOperation({
    summary: 'Read recent Docker container logs for an application.',
  })
  @ApiOkResponse({ type: ApplicationLogDto })
  containerLogs(@Param('id') id: string, @Query('tail') tail?: string) {
    return this.runtime.containerLogs(id, tail ? Number(tail) : undefined);
  }

  @Get(':id/logs/orchestrator')
  @ApiOperation({
    summary: 'Read recent orchestrator lifecycle events for an application.',
  })
  @ApiOkResponse({ type: ApplicationLogDto })
  orchestratorLogs(@Param('id') id: string, @Query('tail') tail?: string) {
    return this.runtime.eventLogs(id, tail ? Number(tail) : undefined);
  }

  @Get(':id/logs/adb')
  @ApiOperation({
    summary: 'Read recent Android logcat output for a running application.',
  })
  @ApiOkResponse({ type: ApplicationLogDto })
  adbLogs(@Param('id') id: string, @Query('tail') tail?: string) {
    return this.runtime.adbLogs(id, tail ? Number(tail) : undefined);
  }
}
