import { Body, Controller, Param, Post, Req, Res } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import type { IncomingHttpHeaders } from "node:http";
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import {
  DisplayCommandResultDto,
  DisplayActionDto,
  DisplayKeyboardDto,
  DisplayTouchDto,
  DisplayWebrtcAnswerDto,
  DisplayWebrtcOfferDto,
} from "./display.dto";
import { DisplayControlService } from "./display-control.service";
import { DisplayViewerAccessService } from "./display-viewer-access.service";
import { DisplayWebrtcService } from "./display-webrtc.service";

@ApiTags("display-public")
@Controller("rebroid/display/public/sessions/:id")
export class DisplayPublicController {
  constructor(
    private readonly access: DisplayViewerAccessService,
    private readonly controls: DisplayControlService,
    private readonly webrtc: DisplayWebrtcService,
  ) {}

  @Post("actions")
  @ApiOperation({
    summary: "Execute an action for the signed-in owner of a display session.",
  })
  @ApiParam({ name: "id", description: "Display session id." })
  @ApiBody({ type: DisplayActionDto })
  @ApiOkResponse({ type: DisplayCommandResultDto })
  async action(
    @Param("id") id: string,
    @Body() body: DisplayActionDto,
    @Req() request: { headers: IncomingHttpHeaders },
  ) {
    await this.access.admit(id, request.headers);
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
    summary:
      "Create a WebRTC answer for the signed-in owner of a display session.",
  })
  @ApiParam({ name: "id", description: "Display session id." })
  @ApiBody({ type: DisplayWebrtcOfferDto })
  @ApiOkResponse({ type: DisplayWebrtcAnswerDto })
  async publicWebrtcOffer(
    @Param("id") id: string,
    @Body() body: DisplayWebrtcOfferDto,
    @Req() request: { headers: IncomingHttpHeaders },
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const abandoned = new AbortController();
    const response = reply.raw;
    const cleanup = () => {
      response.off("finish", cleanup);
      response.off("close", onClose);
    };
    const onClose = () => {
      cleanup();
      if (!response.writableFinished) abandoned.abort();
    };
    response.once("finish", cleanup);
    response.once("close", onClose);
    if (response.destroyed) onClose();

    const { consumerAttemptId, ...answer } = await this.webrtc.createAnswer({
      sessionId: id,
      headers: request.headers,
      signal: abandoned.signal,
      sdp: body.sdp,
      bitrate: body.bitrate,
      maxFps: body.maxFps,
      maxSize: body.maxSize,
      iFrameInterval: body.iFrameInterval,
      audio: body.audio === true,
    });
    if (consumerAttemptId)
      reply.header("x-rebroid-webrtc-attempt", consumerAttemptId);
    return answer;
  }

  @Post("keyboard")
  @ApiOperation({
    summary:
      "Send a keyboard event for the signed-in owner of a display session.",
  })
  @ApiParam({ name: "id", description: "Display session id." })
  @ApiBody({ type: DisplayKeyboardDto })
  @ApiOkResponse({ type: DisplayCommandResultDto })
  async keyboard(
    @Param("id") id: string,
    @Body() body: DisplayKeyboardDto,
    @Req() request: { headers: IncomingHttpHeaders },
  ) {
    await this.access.admit(id, request.headers);
    return {
      ok: true,
      ...(await this.controls.execute(id, { ...body, type: "keyboard" })),
    };
  }

  @Post("touch")
  @ApiOperation({
    summary: "Send a touch event for the signed-in owner of a display session.",
  })
  @ApiParam({ name: "id", description: "Display session id." })
  @ApiBody({ type: DisplayTouchDto })
  @ApiOkResponse({ type: DisplayCommandResultDto })
  async touch(
    @Param("id") id: string,
    @Body() body: DisplayTouchDto,
    @Req() request: { headers: IncomingHttpHeaders },
  ) {
    await this.access.admit(id, request.headers);
    return {
      ok: true,
      ...(await this.controls.execute(id, { ...body, type: "touch" })),
    };
  }
}
