import { Injectable } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';

@Injectable()
export class SidecarConfigService {
  readonly port = Number(process.env.PORT ?? 8000);
  readonly sessionTtlSeconds = Number(process.env.DISPLAY_SESSION_TTL_SECONDS ?? 900);
  readonly scrcpyVersion = process.env.SCRCPY_VERSION?.trim() || '4.0';
  readonly scrcpyServerPath = process.env.SCRCPY_SERVER_PATH?.trim() || '/opt/rebroid-display-sidecar/scrcpy-server';
  readonly sharedSecret = this.readSecret();

  get hasSharedSecret() {
    return this.sharedSecret.length > 0;
  }

  private readSecret() {
    const inline =
      process.env.DISPLAY_SIDECAR_SHARED_SECRET?.trim() ||
      process.env.ORCHESTRATOR_SHARED_SECRET?.trim();
    if (inline) {
      return inline;
    }

    const filePath =
      process.env.DISPLAY_SIDECAR_SHARED_SECRET_FILE?.trim() ||
      process.env.ORCHESTRATOR_SHARED_SECRET_FILE?.trim();
    if (filePath && existsSync(filePath)) {
      return readFileSync(filePath, 'utf8').trim();
    }

    return '';
  }
}
