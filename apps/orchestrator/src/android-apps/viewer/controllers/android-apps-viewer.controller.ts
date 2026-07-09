import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import {
  ApplicationViewerControlDto,
  ApplicationViewerControlResponseDto,
} from '../../contracts/application-viewer-control';
import {
  DisplayRecordingDto,
  DisplaySessionDto,
  ScrcpySessionDto,
} from '../dto/scrcpy-session.dto';
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

  @Post(':id/viewer/displays/:surfaceId/recording/start')
  @ApiOperation({ summary: 'Start recording one display surface.' })
  @ApiOkResponse({ type: DisplayRecordingDto })
  startRecording(
    @Param('id') id: string,
    @Param('surfaceId') surfaceId: string,
  ) {
    return this.viewer.startRecording(id, surfaceId);
  }

  @Post(':id/viewer/displays/:surfaceId/recording/stop')
  @ApiOperation({
    summary: 'Stop recording one display surface and return the file data.',
  })
  @ApiOkResponse({ type: DisplayRecordingDto })
  stopRecording(
    @Param('id') id: string,
    @Param('surfaceId') surfaceId: string,
  ) {
    return this.viewer.stopRecording(id, surfaceId);
  }

  @Get(':id/viewer/recordings/:recordingId')
  @ApiOperation({ summary: 'Download one completed display recording.' })
  async downloadRecording(
    @Param('id') id: string,
    @Param('recordingId') recordingId: string,
    @Query('surfaceSessionId') surfaceSessionId: string,
    @Res() response: FastifyReply,
  ) {
    const { recording, response: upstream } =
      await this.viewer.downloadRecording(id, surfaceSessionId, recordingId);
    if (!upstream.body) {
      response.status(502).send('Display recording download is empty.');
      return;
    }

    response
      .type(recording.mimeType)
      .header(
        'content-disposition',
        `attachment; filename="${recording.fileName.replace(/"/g, '')}"`,
      )
      .send(
        Readable.fromWeb(
          upstream.body as unknown as NodeReadableStream<Uint8Array>,
        ),
      );
  }
}
