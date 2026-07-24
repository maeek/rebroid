import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ScrcpyService } from "../scrcpy/scrcpy.service";
import { DisplaySessionService } from "./display-session.service";
import { DisplayWebrtcService } from "./display-webrtc.service";

@Injectable()
export class DisplaySessionLifecycleService
  implements OnModuleInit, OnModuleDestroy
{
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly sessions: DisplaySessionService,
    private readonly scrcpy: ScrcpyService,
    private readonly webrtc: DisplayWebrtcService,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.sessions.onClosed((sessionId) => {
      this.webrtc.stopSession(sessionId);
      this.scrcpy.closeSession(sessionId);
    });
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }
}
