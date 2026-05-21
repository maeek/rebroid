import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApplicationViewerControlDto,
  ApplicationViewerControlResponseDto,
} from '../dto/application-viewer-control.dto';
import { ScrcpySessionDto } from '../dto/scrcpy-session.dto';
import { AndroidAppsViewerService } from '../services/android-apps-viewer.service';

@ApiTags('android-applications')
@Controller('android-applications')
export class AndroidAppsViewerController {
  constructor(private readonly viewer: AndroidAppsViewerService) {}

  @Get(':id/scrcpy-session')
  @ApiOkResponse({ type: ScrcpySessionDto })
  scrcpySession(@Param('id') id: string) {
    return this.viewer.scrcpySession(id);
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
    return this.viewer.recordViewerActivity(id);
  }

  @Post(':id/viewer-control')
  @ApiOperation({
    summary: 'Send a viewer control command to the running Android runtime.',
  })
  @ApiOkResponse({ type: ApplicationViewerControlResponseDto })
  viewerControl(
    @Param('id') id: string,
    @Body() dto: ApplicationViewerControlDto,
  ) {
    return this.viewer.viewerControl(id, dto.command);
  }
}
