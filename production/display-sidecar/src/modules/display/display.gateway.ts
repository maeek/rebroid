import { Logger } from '@nestjs/common';
import { OnGatewayConnection, WebSocketGateway } from '@nestjs/websockets';
import { IncomingMessage } from 'node:http';
import { WebSocket } from 'ws';
import { ScrcpyService } from '../scrcpy/scrcpy.service';
import { ScrcpyVideoCodec } from '../scrcpy/scrcpy.types';
import { DisplaySessionService } from './display-session.service';

const DEFAULT_MAX_SIZE = 1080;
const MIN_SAFE_MAX_SIZE = 1080;
const DEFAULT_MAX_FPS = 60;
const DEFAULT_BITRATE = 7_000_000;

@WebSocketGateway({ path: '/rebroid/display/stream' })
export class DisplayGateway implements OnGatewayConnection {
  private readonly logger = new Logger(DisplayGateway.name);

  constructor(
    private readonly sessions: DisplaySessionService,
    private readonly scrcpy: ScrcpyService,
  ) {}

  async handleConnection(client: WebSocket, request: IncomingMessage) {
    try {
      const url = new URL(request.url ?? '', 'http://display-sidecar.local');
      const sessionId = url.searchParams.get('sessionId');
      const token = url.searchParams.get('token');

      if (!sessionId) {
        client.close(1008, 'Missing sessionId');
        return;
      }

      const session = this.sessions.assertStreamToken(sessionId, token);
      await this.scrcpy.streamRawVideo({
        sessionId,
        udid: session.udid,
        client,
        codec: this.parseCodec(url.searchParams.get('codec')),
        maxSize: this.parseMaxSize(url.searchParams.get('maxSize')),
        maxFps: this.parseNumber(url.searchParams.get('maxFps'), DEFAULT_MAX_FPS, 1, 240),
        bitrate: this.parseNumber(url.searchParams.get('bitrate'), DEFAULT_BITRATE, 100_000, 100_000_000),
        iFrameInterval: this.parseOptionalNumber(url.searchParams.get('iFrameInterval'), 1, 60),
        onActivity: () => {
          this.sessions.touch(sessionId);
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Display stream failed: ${message}`);
      if (client.readyState === WebSocket.OPEN) {
        client.close(1011, message.slice(0, 120));
      }
    }
  }

  private parseCodec(value: string | null): ScrcpyVideoCodec {
    return value === 'h265' ? 'h265' : 'h264';
  }

  private parseMaxSize(value: string | null) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return DEFAULT_MAX_SIZE;
    }

    const rounded = Math.round(parsed);
    if (rounded === 0) {
      return 0;
    }

    return Math.min(Math.max(rounded, MIN_SAFE_MAX_SIZE), 4096);
  }

  private parseNumber(value: string | null, fallback: number, min: number, max: number) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return Math.min(Math.max(Math.round(parsed), min), max);
  }

  private parseOptionalNumber(value: string | null, min: number, max: number) {
    if (value === null || value.trim() === '') {
      return undefined;
    }
    return this.parseNumber(value, min, min, max);
  }
}
