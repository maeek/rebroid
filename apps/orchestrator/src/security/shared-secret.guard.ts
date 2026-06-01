import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';

const secretHeaderName = 'x-orchestrator-secret';

@Injectable()
export class SharedSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext) {
    const sharedSecret = this.config.get<string>('app.sharedSecret');
    if (!sharedSecret) {
      throw new UnauthorizedException(
        'ORCHESTRATOR_SHARED_SECRET is not configured.',
      );
    }

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      url: string;
    }>();
    if (request.url === '/health/live') {
      return true;
    }
    const headerValue = request.headers[secretHeaderName];
    const providedSecret = Array.isArray(headerValue)
      ? headerValue[0]
      : headerValue;
    if (!providedSecret || !this.matches(sharedSecret, providedSecret)) {
      throw new UnauthorizedException(
        'Missing or invalid orchestrator shared secret.',
      );
    }

    return true;
  }

  private matches(expected: string, actual: string) {
    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(actual);
    return (
      expectedBuffer.length === actualBuffer.length &&
      timingSafeEqual(expectedBuffer, actualBuffer)
    );
  }
}

export { secretHeaderName };
