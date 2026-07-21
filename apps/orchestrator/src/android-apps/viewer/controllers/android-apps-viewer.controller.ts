import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApplicationViewerControlDto,
  ApplicationViewerControlResponseDto,
} from '../../contracts/application-viewer-control';
import { DisplaySessionDto, ScrcpySessionDto } from '../dto/scrcpy-session.dto';
import { AndroidAppsViewerService } from '../services/android-apps-viewer.service';

@ApiTags('app-viewer')
@Controller('apps')
export class AndroidAppsViewerController {
  constructor(private readonly viewer: AndroidAppsViewerService) {}

  @Get(':id/viewer/session')
  @ApiOkResponse({ type: ScrcpySessionDto })
  scrcpySession(
    @Param('id') id: string,
    @Query('control') control?: string,
    @Query('clipboard') clipboard?: string,
    @Query('screenshot') screenshot?: string,
  ) {
    return this.viewer.scrcpySession(id, {
      control: control === 'true',
      clipboard: clipboard === 'true',
      screenshot: screenshot === 'true',
    });
  }

  @Post(':id/viewer/activity')
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

  @Post(':id/viewer/control')
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

  @Post(':id/viewer/displays')
  @ApiOperation({
    summary: 'Create or reuse one experimental virtual display surface.',
  })
  @ApiOkResponse({ type: DisplaySessionDto })
  createVirtualDisplay(@Param('id') id: string) {
    return this.viewer.createVirtualDisplay(id);
  }

  @Post(':id/viewer/displays/:surfaceId/release')
  @ApiOperation({
    summary: 'Release one experimental virtual display surface.',
  })
  @ApiOkResponse({ type: DisplaySessionDto })
  releaseVirtualDisplay(
    @Param('id') id: string,
    @Param('surfaceId') surfaceId: string,
  ) {
    return this.viewer.releaseVirtualDisplay(id, surfaceId);
  }
}
