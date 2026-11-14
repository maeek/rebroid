import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IncomingHttpHeaders } from 'node:http';
import { z } from 'zod';

const identitySchema = z.object({
  userId: z.string().min(1).max(200),
  accountSessionId: z.uuid(),
});

export type DockerTerminalIdentity = z.infer<typeof identitySchema>;

export const terminalBrowserCredentials = (headers: IncomingHttpHeaders) => {
  const { host, origin } = headers;
  const cookie = headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .filter((part) =>
      /^(__Secure-)?next-auth\.session-token(?:\.\d+)?=/.test(part),
    )
    .join('; ');
  if (!host || !origin || !cookie || !/^[a-z0-9.:[\]-]+$/i.test(host))
    return null;
  try {
    // nginx selects a configured public host and sets Host on this dedicated route.
    if (origin !== new URL(`https://${host}`).origin) return null;
  } catch {
    return null;
  }
  return { host, cookie };
};

@Injectable()
export class DockerTerminalAuthorizationService {
  constructor(private readonly config: ConfigService) {}

  async authorize(
    credentials: NonNullable<ReturnType<typeof terminalBrowserCredentials>>,
    signal?: AbortSignal,
  ): Promise<DockerTerminalIdentity | null> {
    try {
      const secret = this.config.getOrThrow<string>('app.sharedSecret');
      const web = this.config.getOrThrow<string>('app.webInternalUrl');
      const timeout = AbortSignal.timeout(2_000);
      const response = await fetch(
        new URL('/api/internal/docker-terminal/authorize', web),
        {
          headers: {
            cookie: credentials.cookie,
            'x-forwarded-host': credentials.host,
            'x-forwarded-proto': 'https',
            'x-orchestrator-secret': secret,
          },
          redirect: 'error',
          cache: 'no-store',
          signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        },
      );
      if (response.ok) return identitySchema.parse(await response.json());
      await response.body?.cancel();
    } catch {
      // Never log the request or response, which can include account credentials.
    }
    return null;
  }
}
