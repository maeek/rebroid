import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AndroidAppsService } from '../android-apps/android-apps.service';

interface ScrcpyClientQuery {
  applicationId?: string;
  ownerUserId?: string;
}

@WebSocketGateway({
  namespace: 'scrcpy',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class ScrcpyGateway implements OnGatewayConnection {
  private readonly logger = new Logger(ScrcpyGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly androidApps: AndroidAppsService) {}

  async handleConnection(client: Socket) {
    const query = client.handshake.query as ScrcpyClientQuery;
    if (!query.applicationId) {
      client.disconnect(true);
      return;
    }

    try {
      const app = await this.androidApps.get(query.applicationId);
      if (query.ownerUserId && app.ownerUserId && query.ownerUserId !== app.ownerUserId) {
        client.disconnect(true);
        return;
      }

      await this.androidApps.touchScrcpyActivity(app.id);
      await client.join(app.id);
      client.emit('session.ready', {
        applicationId: app.id,
        transport: app.scrcpyTransport,
        adbHost: app.containerName,
        adbPort: app.adbPort,
      });
    } catch (error) {
      this.logger.warn(`Rejected scrcpy client: ${this.errorMessage(error)}`);
      client.disconnect(true);
    }
  }

  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @SubscribeMessage('client.activity')
  async onClientActivity(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { applicationId?: string },
  ) {
    const applicationId = payload.applicationId ?? this.firstJoinedApplicationRoom(client);
    if (!applicationId) {
      return { ok: false };
    }

    await this.androidApps.touchScrcpyActivity(applicationId);
    return { ok: true };
  }

  @SubscribeMessage('scrcpy.input')
  async onScrcpyInput(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { applicationId?: string; event?: unknown },
  ) {
    const applicationId = payload.applicationId ?? this.firstJoinedApplicationRoom(client);
    if (!applicationId) {
      return { ok: false };
    }

    await this.androidApps.touchScrcpyActivity(applicationId);

    return {
      ok: true,
      queued: false,
      reason:
        'scrcpy proxying is not wired yet. This gateway currently tracks activity and reserves the API contract.',
    };
  }

  private firstJoinedApplicationRoom(client: Socket) {
    return [...client.rooms].find((room) => room !== client.id);
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Unknown error';
  }
}
