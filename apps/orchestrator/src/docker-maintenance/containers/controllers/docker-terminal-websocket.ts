import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  DockerTerminalAuthorizationService,
  terminalBrowserCredentials,
  type DockerTerminalIdentity,
} from '../services/docker-terminal-authorization.service';
import { DockerTerminalSessionService } from '../services/docker-terminal-session.service';

const containerId = z.string().regex(/^[a-f0-9]{64}$/);
const accountPart = '[a-zA-Z0-9_][a-zA-Z0-9_.-]*';
const targetQuery = z.strictObject({
  startedAt: z.iso.datetime({ offset: true }),
  user: z
    .string()
    .max(128)
    .regex(new RegExp(`^${accountPart}(?::${accountPart})?$`))
    .optional(),
});

export const registerDockerTerminalWebSocket = (
  fastify: FastifyInstance,
  authorization: DockerTerminalAuthorizationService,
  sessions: DockerTerminalSessionService,
) => {
  const admitted = new WeakMap<
    FastifyRequest,
    {
      target: z.infer<typeof targetQuery> & { containerId: string };
      credentials: NonNullable<ReturnType<typeof terminalBrowserCredentials>>;
      identity: DockerTerminalIdentity;
    }
  >();
  fastify.get<{ Params: { id: string } }>(
    '/terminal/docker/containers/:id',
    {
      websocket: true,
      preValidation: async (request, reply) => {
        const id = containerId.safeParse(request.params.id);
        const query = targetQuery.safeParse(request.query);
        const credentials = terminalBrowserCredentials(request.headers);
        if (!id.success || !query.success) return reply.code(400).send();
        if (!credentials) return reply.code(403).send();
        const identity = await authorization.authorize(credentials);
        if (!identity) return reply.code(403).send();
        admitted.set(request, {
          target: { ...query.data, containerId: id.data },
          credentials,
          identity,
        });
      },
    },
    (socket, request) => {
      const access = admitted.get(request);
      if (!access) {
        socket.close(1008, 'Terminal access denied.');
        return;
      }
      admitted.delete(request);
      void sessions.connect(socket, access.target, access.identity, (signal) =>
        authorization.authorize(access.credentials, signal),
      );
    },
  );
};
