import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import websocket from '@fastify/websocket';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';
import type { WebSocket } from '@fastify/websocket';
import { AutomationRunEventBus } from './automation-run-event-bus.service';

interface SubscribeToken {
  ownerUserId: string;
  runId: string;
  expiresAt: number;
}

@Injectable()
export class AutomationRunEventStreamService {
  private readonly tokens = new Map<string, SubscribeToken>();

  constructor(private readonly events: AutomationRunEventBus) {}

  createSubscribeToken(ownerUserId: string, runId: string) {
    const token = randomUUID();
    this.tokens.set(token, {
      ownerUserId,
      runId,
      expiresAt: Date.now() + 60_000,
    });
    return { token, expiresAt: new Date(Date.now() + 60_000).toISOString() };
  }

  async register(fastify: FastifyInstance) {
    await fastify.register(websocket);
    fastify.get(
      '/api/v1/automations/runs/events/ws',
      { websocket: true },
      async (socket: WebSocket, request: FastifyRequest) => {
        const url = new URL(request.url, 'http://localhost');
        const token = url.searchParams.get('token') ?? '';
        const after = Number(url.searchParams.get('after') ?? '0');
        const subscription = this.consumeToken(token);
        const send = (payload: unknown) => {
          if (socket.readyState === 1) {
            socket.send(JSON.stringify(payload));
          }
        };

        for (const event of await this.events.list(
          subscription.ownerUserId,
          subscription.runId,
          after,
        )) {
          send({ type: 'event', event });
        }

        const unsubscribe = this.events.subscribe(
          subscription.runId,
          (event) => {
            if (event.ownerUserId === subscription.ownerUserId) {
              send({ type: 'event', event });
            }
          },
        );
        const heartbeat = setInterval(
          () => send({ type: 'heartbeat', at: new Date().toISOString() }),
          15_000,
        );
        socket.on('close', () => {
          clearInterval(heartbeat);
          unsubscribe();
        });
      },
    );
  }

  private consumeToken(token: string) {
    const subscription = this.tokens.get(token);
    this.tokens.delete(token);
    if (!subscription || subscription.expiresAt < Date.now()) {
      throw new UnauthorizedException(
        'Automation event stream token is invalid or expired.',
      );
    }
    if (!subscription.ownerUserId || !subscription.runId) {
      throw new BadRequestException(
        'Automation event stream token is incomplete.',
      );
    }
    return subscription;
  }
}
