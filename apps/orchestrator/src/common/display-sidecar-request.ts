import type { ConfigService } from '@nestjs/config';

export function displaySidecarUrl(config: ConfigService, path: string) {
  const baseUrl = config
    .getOrThrow<string>('app.displaySidecar.internalBaseUrl')
    .replace(/\/$/, '');
  return `${baseUrl}${path}`;
}

export function displaySidecarJsonHeaders(
  config: ConfigService,
  { body, headers: initialHeaders }: RequestInit,
) {
  const headers = new Headers(initialHeaders);
  if (body != null && `${body}`.length > 0 && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  const secret = config.get<string>('app.sharedSecret');
  if (secret) {
    headers.set('x-rebroid-sidecar-secret', secret);
  }
  return headers;
}
