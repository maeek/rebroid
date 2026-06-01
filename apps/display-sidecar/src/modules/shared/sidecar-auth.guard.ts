import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { timingSafeEqual } from "node:crypto";
import { SidecarConfigService } from "./sidecar-config.service";
import { Logger } from "@nestjs/common";

@Injectable()
export class SidecarAuthGuard implements CanActivate {
  private readonly logger = new Logger(SidecarAuthGuard.name);

  constructor(private readonly config: SidecarConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    if (!this.config.hasSharedSecret) {
      if (this.config.allowUnauthenticatedInternalApi) {
        this.logger.warn(
          "No sidecar shared secret configured; authentication is explicitly disabled.",
        );
        return true;
      }
      throw new UnauthorizedException("Sidecar shared secret is required.");
    }

    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | string[] | undefined> }>();
    const provided = this.readHeader(
      request.headers["x-rebroid-sidecar-secret"],
    );
    if (
      !provided ||
      !this.constantTimeEquals(provided, this.config.sharedSecret)
    ) {
      throw new UnauthorizedException("Invalid sidecar shared secret.");
    }

    return true;
  }

  private readHeader(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value;
  }

  private constantTimeEquals(left: string, right: string) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return (
      leftBuffer.length === rightBuffer.length &&
      timingSafeEqual(leftBuffer, rightBuffer)
    );
  }
}
