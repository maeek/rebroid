import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { SidecarAuthGuard } from '../shared/sidecar-auth.guard';
import { AdbService, ViewerCommand } from './adb.service';

const viewerCommands = new Set<ViewerCommand>([
  'back',
  'home',
  'recents',
  'power',
  'wake',
  'sleep',
  'volume-up',
  'volume-down',
  'mute',
  'rotate',
  'expand-notifications',
  'expand-settings',
  'collapse-panels',
]);

interface ControlBody {
  command?: string;
}

interface ClipboardBody {
  text?: string;
}

const clampTail = (value: string | undefined) => {
  const parsed = Number(value ?? 300);
  if (!Number.isFinite(parsed)) {
    return 300;
  }

  return Math.max(1, Math.min(Math.trunc(parsed), 2000));
};

@UseGuards(SidecarAuthGuard)
@Controller('rebroid/adb/:udid')
export class AdbController {
  constructor(private readonly adb: AdbService) {}

  @Post('control')
  async control(@Param('udid') udid: string, @Body() body: ControlBody) {
    if (!body.command || !viewerCommands.has(body.command as ViewerCommand)) {
      return {
        command: body.command ?? null,
        executed: false,
        message: `Unsupported ADB control command: ${body.command ?? 'missing'}`,
      };
    }

    const command = body.command as ViewerCommand;
    const result = await this.adb.viewerAction(udid, command);
    return {
      command,
      executed: true,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  @Get('clipboard')
  getClipboard(@Param('udid') udid: string) {
    return this.adb.getClipboard(udid);
  }

  @Put('clipboard')
  setClipboard(@Param('udid') udid: string, @Body() body: ClipboardBody) {
    return this.adb.setClipboard(udid, body.text ?? '');
  }

  @Get('logcat')
  async logcat(@Param('udid') udid: string, @Query('tail') tail?: string) {
    const result = await this.adb.logcat(udid, clampTail(tail));
    return {
      source: 'adb' as const,
      collectedAt: new Date().toISOString(),
      output: result.stdout,
    };
  }

  @Get('notifications')
  async notifications(@Param('udid') udid: string) {
    const result = await this.adb.notifications(udid);
    return {
      output: result.stdout,
    };
  }

  @Get('screenshot')
  async screenshot(@Param('udid') udid: string) {
    const image = await this.adb.screencapPng(udid);
    return {
      mimeType: 'image/png',
      dataUrl: `data:image/png;base64,${image.toString('base64')}`,
      capturedAt: new Date().toISOString(),
    };
  }
}
