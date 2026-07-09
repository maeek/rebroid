import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
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

const subscribeTokenTtlMs = 60_000;
const maxSubscribeTokens = 10_000;

@Injectable()
export class AutomationRunEventStreamService {
  private readonly tokens = new Map<string, SubscribeToken>();

  constructor(private readonly events: AutomationRunEventBus) {}

  createSubscribeToken(ownerUserId: string, runId: string) {
    this.purgeExpiredTokens();
    if (this.tokens.size >= maxSubscribeTokens) {
      throw new ServiceUnavailableException(
        'Automation event stream token capacity is temporarily exhausted.',
      );
    }
    const token = randomUUID();
    const expiresAt = Date.now() + subscribeTokenTtlMs;
    this.tokens.set(token, {
      ownerUserId,
      runId,
      expiresAt,
    });
    return { token, expiresAt: new Date(expiresAt).toISOString() };
  }

  async register(fastify: FastifyInstance) {
    await fastify.register(websocket);
    fastify.get(
      '/api/v1/automations/runs/events/ws',
      { websocket: true },
      async (socket: WebSocket, request: FastifyRequest) => {
        const url = new URL(request.url, 'http://localhost');
        const token = url.searchParams.get('token') ?? '';
        const requestedAfter = Number(url.searchParams.get('after') ?? '0');
        const after = Number.isFinite(requestedAfter)
          ? Math.max(0, Math.trunc(requestedAfter))
          : 0;
        const subscription = this.consumeToken(token);
        const send = (payload: unknown) => {
          if (socket.readyState === 1) {
            socket.send(JSON.stringify(payload));
          }
        };

        let unsubscribe: (() => void) | null = null;
        let heartbeat: NodeJS.Timeout | null = null;
        let cleanedUp = false;
        const cleanup = () => {
          if (cleanedUp) return;
          cleanedUp = true;
          if (heartbeat) clearInterval(heartbeat);
          unsubscribe?.();
        };
        socket.once('close', cleanup);
        socket.once('error', cleanup);
        try {
          unsubscribe = await this.events.subscribeWithReplay(
            subscription.ownerUserId,
            subscription.runId,
            after,
            (event) => {
              send({ type: 'event', event });
            },
          );
          if (cleanedUp) {
            unsubscribe();
            return;
          }
          heartbeat = setInterval(
            () => send({ type: 'heartbeat', at: new Date().toISOString() }),
            15_000,
          );
        } catch (error) {
          cleanup();
          socket.close(1011, 'Automation event stream setup failed.');
          throw error;
        }
      },
    );
  }

  private consumeToken(token: string) {
    this.purgeExpiredTokens();
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

  private purgeExpiredTokens(now = Date.now()) {
    for (const [token, subscription] of this.tokens) {
      if (subscription.expiresAt < now) {
        this.tokens.delete(token);
      }
    }
  }
}
