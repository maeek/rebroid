import { Body, Controller, Param, Post, Req } from "@nestjs/common";
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import {
  DisplayCommandResultDto,
  DisplayKeyboardDto,
  DisplayTouchDto,
  DisplayWebrtcAnswerDto,
  DisplayWebrtcOfferDto,
  PublicDisplayActionDto,
} from "./display.dto";
import { DisplayControlService } from "./display-control.service";
import { DisplaySessionService } from "./display-session.service";
import { DisplayWebrtcService } from "./display-webrtc.service";

@ApiTags("display-public")
@Controller("rebroid/display/public/sessions/:id")
export class DisplayPublicController {
  constructor(
    private readonly sessions: DisplaySessionService,
    private readonly controls: DisplayControlService,
    private readonly webrtc: DisplayWebrtcService,
  ) {}

  @Post("actions")
  @ApiOperation({
    summary: "Execute a viewer control action using a display session token.",
  })
  @ApiParam({ name: "id", description: "Display session id." })
  @ApiBody({ type: PublicDisplayActionDto })
  @ApiOkResponse({ type: DisplayCommandResultDto })
  async action(@Param("id") id: string, @Body() body: PublicDisplayActionDto) {
    this.sessions.assertStreamToken(id, body.token ?? null);
    return {
      ok: true,
      ...(await this.controls.execute(id, {
        type: "action",
        command: body.command,
      })),
    };
  }

  @Post("webrtc/offer")
  @ApiOperation({
    summary: "Create a WebRTC display answer using a display session token.",
  })
  @ApiParam({ name: "id", description: "Display session id." })
  @ApiBody({ type: DisplayWebrtcOfferDto })
  @ApiOkResponse({ type: DisplayWebrtcAnswerDto })
  publicWebrtcOffer(
    @Param("id") id: string,
    @Body() body: DisplayWebrtcOfferDto,
    @Req() request: { headers: Record<string, string | string[] | undefined> },
  ) {
    const hostHeader =
      request.headers["x-rebroid-viewer-host"] ??
      request.headers["x-forwarded-host"] ??
      request.headers.host;
    const requestHost = Array.isArray(hostHeader)
      ? (hostHeader[0] ?? null)
      : (hostHeader ?? null);
    return this.webrtc.createAnswer({
      sessionId: id,
      token: body.token ?? null,
      sdp: body.sdp,
      requestHost,
      bitrate: body.bitrate,
      maxFps: body.maxFps,
      maxSize: body.maxSize,
      iFrameInterval: body.iFrameInterval,
      audio: body.audio === true,
    });
  }

  @Post("keyboard")
  @ApiOperation({
    summary: "Send a browser keyboard event using a display session token.",
  })
  @ApiParam({ name: "id", description: "Display session id." })
  @ApiBody({ type: DisplayKeyboardDto })
  @ApiOkResponse({ type: DisplayCommandResultDto })
  async keyboard(@Param("id") id: string, @Body() body: DisplayKeyboardDto) {
    this.sessions.assertStreamToken(id, body.token ?? null);
    return {
      ok: true,
      ...(await this.controls.execute(id, { type: "keyboard", ...body })),
    };
  }

  @Post("touch")
  @ApiOperation({
    summary: "Send a tap or swipe event using a display session token.",
  })
  @ApiParam({ name: "id", description: "Display session id." })
  @ApiBody({ type: DisplayTouchDto })
  @ApiOkResponse({ type: DisplayCommandResultDto })
  async touch(@Param("id") id: string, @Body() body: DisplayTouchDto) {
    this.sessions.assertStreamToken(id, body.token ?? null);
    return {
      ok: true,
      ...(await this.controls.execute(id, { type: "touch", ...body })),
    };
  }
}
