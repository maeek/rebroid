import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from "@nestjs/common";
import { ExternalAdbAttachments } from "../external-adb/external-adb-attachments";
import { ScrcpyService } from "../scrcpy/scrcpy.service";
import { DisplaySessionService } from "./display-session.service";
import { DisplayWebrtcService } from "./display-webrtc.service";

@Injectable()
export class DisplaySessionLifecycleService
  implements OnModuleInit, OnModuleDestroy
{
  private unsubscribe: (() => void) | null = null;
  private unsubscribeAttachment?: () => void;

  constructor(
    private readonly sessions: DisplaySessionService,
    private readonly scrcpy: ScrcpyService,
    private readonly webrtc: DisplayWebrtcService,
    @Optional() private readonly attachments?: ExternalAdbAttachments,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.sessions.onClosed((sessionId) => {
      this.webrtc.stopSession(sessionId);
      this.scrcpy.closeSession(sessionId);
    });
    this.unsubscribeAttachment = this.attachments?.onRetired((attachmentId) =>
      this.sessions.releaseForAttachment(attachmentId),
    );
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.unsubscribeAttachment?.();
  }
}
