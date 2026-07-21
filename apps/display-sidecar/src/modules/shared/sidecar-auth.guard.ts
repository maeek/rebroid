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
    const header = request.headers["x-rebroid-sidecar-secret"];
    const provided = Array.isArray(header) ? header[0] : header;
    const expected = this.config.sharedSecret;
    const providedBuffer = Buffer.from(provided ?? "");
    const expectedBuffer = Buffer.from(expected);
    const matches =
      providedBuffer.length === expectedBuffer.length &&
      timingSafeEqual(providedBuffer, expectedBuffer);
    if (!provided || !matches) {
      throw new UnauthorizedException("Invalid sidecar shared secret.");
    }

    return true;
  }
}
