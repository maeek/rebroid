import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBody,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { AdbService } from "../adb/adb.service";
import { ScrcpyService } from "../scrcpy/scrcpy.service";
import { SidecarAuthGuard } from "../shared/sidecar-auth.guard";
import { SidecarFeatureService } from "../shared/sidecar-feature.service";
import {
  CreateDisplaySessionDto,
  CreateDisplaySurfaceDto,
  DisplayActionDto,
  DisplayCapabilitiesDto,
  DisplayClipboardDto,
  DisplayClipboardResultDto,
  DisplayCommandResultDto,
  DisplayHealthDto,
  DisplayLogcatDto,
  DisplaySessionDto,
  DisplaySessionInventoryDto,
  DisplaySessionRevocationDto,
  DisplaySessionListResponseDto,
  DisplaySessionResponseDto,
  DisplaySurfaceListResponseDto,
  RevokeDisplaySessionsDto,
} from "./display.dto";
import { z } from "zod";
import { viewerCommands } from "@rebroid/android-application-core/viewer-control";
import { DisplaySessionService } from "./display-session.service";
import { DisplayWebrtcService } from "./display-webrtc.service";
import { DisplayControlService } from "./display-control.service";

const revokeDisplaySessionsSchema = z.strictObject({
  ownerUserIds: z
    .array(
      z
        .string()
        .min(1)
        .max(200)
        .refine((id) => id.trim() === id),
    )
    .min(1)
    .max(256),
});

@Controller()
@ApiTags("display")
export class DisplayController {
  constructor(
    private readonly sessions: DisplaySessionService,
    private readonly adb: AdbService,
    private readonly scrcpy: ScrcpyService,
    private readonly webrtc: DisplayWebrtcService,
    private readonly controls: DisplayControlService,
    private readonly features: SidecarFeatureService,
  ) {}

  @Get("rebroid/display/health")
  @ApiOperation({ summary: "Read display service health." })
  @ApiOkResponse({ type: DisplayHealthDto })
  health() {
    return { ok: true, service: "rebroid-display" };
  }

  @Get("rebroid/display/capabilities")
  @ApiOperation({ summary: "Read display stream and control capabilities." })
  @ApiOkResponse({ type: DisplayCapabilitiesDto })
  capabilities() {
    const webrtc = this.features.isWebrtcEnabled() ? ["webrtc"] : [];
    return {
      stream: {
        protocols: ["websocket", ...webrtc],
        adapters: ["scrcpy-server-v4-rbd1"],
        codecs: ["h264"],
        audioCodecs: ["opus"],
        defaultCodec: "h264",
        players: ["webcodecs", ...webrtc],
      },
      compatibility: {
        scrcpyVersion: this.scrcpy.serverVersion(),
        supportedAndroidVersions: ["13", "14", "15", "16"],
        unsupportedAndroidVersions: ["17"],
        fallbackModes: ["audio-disabled", "stream-control-disabled"],
      },
      surfaces: {
        defaultSurface: "main",
        virtualDisplayLimit: 1,
        virtualDisplayDefault: "1280x720/160",
      },
      actions: viewerCommands,
      adbOwnedBySidecar: true,
      features: this.features.state().features,
    };
  }

  @UseGuards(SidecarAuthGuard)
  @Post("rebroid/display/sessions")
  @ApiOperation({
    summary:
      "Create or reuse an owner-scoped display session for an ADB target.",
  })
  @ApiHeader({
    name: "x-rebroid-sidecar-secret",
    required: false,
    description: "Required when sidecar shared-secret auth is configured.",
  })
  @ApiBody({ type: CreateDisplaySessionDto })
  @ApiOkResponse({ type: DisplaySessionResponseDto })
  async createSession(@Body() body: CreateDisplaySessionDto) {
    await this.adb.ensureConnected(body.udid);
    return {
      session: this.sessions.create(body),
    };
  }

  @UseGuards(SidecarAuthGuard)
  @Get("rebroid/display/sessions")
  @ApiOperation({
    summary: "List display sessions known to this sidecar instance.",
  })
  @ApiHeader({ name: "x-rebroid-sidecar-secret", required: false })
  @ApiOkResponse({ type: DisplaySessionListResponseDto })
  listSessions() {
    return { items: this.sessions.list() };
  }

  @UseGuards(SidecarAuthGuard)
  @Get("rebroid/display/sessions/inventory")
  @ApiOperation({
    summary: "List display session metadata for administration.",
  })
  @ApiHeader({ name: "x-rebroid-sidecar-secret", required: false })
  @ApiOkResponse({ type: DisplaySessionInventoryDto })
  listSessionInventory() {
    return { items: this.sessions.listInventory() };
  }

  @UseGuards(SidecarAuthGuard)
  @Post("rebroid/display/sessions/revoke")
  @HttpCode(200)
  @ApiOperation({
    summary: "Revoke display sessions owned by the supplied accounts.",
  })
  @ApiHeader({ name: "x-rebroid-sidecar-secret", required: false })
  @ApiBody({ type: RevokeDisplaySessionsDto })
  @ApiOkResponse({ type: DisplaySessionRevocationDto })
  revokeSessions(@Body() body: unknown) {
    const result = revokeDisplaySessionsSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(
        "Supply a bounded list of valid owner IDs.",
      );
    }
    return {
      released: this.sessions.releaseForOwners(result.data.ownerUserIds),
    };
  }

  @UseGuards(SidecarAuthGuard)
  @Get("rebroid/display/sessions/:id")
  @ApiOperation({ summary: "Read one display session." })
  @ApiHeader({ name: "x-rebroid-sidecar-secret", required: false })
  @ApiParam({ name: "id", description: "Display session id." })
  @ApiOkResponse({ type: DisplaySessionDto })
  getSession(@Param("id") id: string) {
    return this.sessions.getPublic(id);
  }

  @UseGuards(SidecarAuthGuard)
  @Get("rebroid/display/sessions/:id/surfaces")
  @ApiOperation({ summary: "List display surfaces for one display session." })
  @ApiHeader({ name: "x-rebroid-sidecar-secret", required: false })
  @ApiParam({ name: "id", description: "Display session id." })
  @ApiOkResponse({ type: DisplaySurfaceListResponseDto })
  listSessionSurfaces(@Param("id") id: string) {
    return { items: this.sessions.getPublic(id).surfaces };
  }

  @UseGuards(SidecarAuthGuard)
  @Post("rebroid/display/sessions/:id/surfaces")
  @ApiOperation({
    summary: "Create or reuse one experimental virtual display surface.",
  })
  @ApiHeader({ name: "x-rebroid-sidecar-secret", required: false })
  @ApiParam({ name: "id", description: "Parent display session id." })
  @ApiBody({ type: CreateDisplaySurfaceDto })
  @ApiOkResponse({ type: DisplaySessionResponseDto })
  createSessionSurface(
    @Param("id") id: string,
    @Body() body: CreateDisplaySurfaceDto,
  ) {
    return { session: this.sessions.createVirtualSurface(id, body) };
  }

  @UseGuards(SidecarAuthGuard)
  @Delete("rebroid/display/sessions/:id/surfaces/:surfaceId")
  @ApiOperation({ summary: "Release one virtual display surface." })
  @ApiHeader({ name: "x-rebroid-sidecar-secret", required: false })
  @ApiParam({ name: "id", description: "Parent display session id." })
  @ApiParam({ name: "surfaceId", description: "Display surface id." })
  @ApiOkResponse({ type: DisplaySessionDto })
  releaseSessionSurface(
    @Param("id") id: string,
    @Param("surfaceId") surfaceId: string,
  ) {
    const session = this.sessions.releaseSurface(id, surfaceId);
    try {
      this.webrtc.stopSession(session.id);
    } catch {
      // Surface release already succeeded. Cleanup is best-effort.
    }
    try {
      this.scrcpy.closeSession(session.id);
    } catch {
      // Surface release already succeeded. Cleanup is best-effort.
    }
    return session;
  }

  @UseGuards(SidecarAuthGuard)
  @Delete("rebroid/display/sessions/apps/:appId")
  @ApiOperation({ summary: "Release every display session for one app." })
  @ApiHeader({ name: "x-rebroid-sidecar-secret", required: false })
  @ApiParam({ name: "appId", description: "Application id." })
  @ApiOkResponse({ type: DisplaySessionListResponseDto })
  releaseAppSessions(@Param("appId") appId: string) {
    const items = this.sessions.releaseForApp(appId);
    for (const session of items) {
      this.webrtc.stopSession(session.id);
      this.scrcpy.closeSession(session.id);
    }
    return { items };
  }

  @UseGuards(SidecarAuthGuard)
  @Delete("rebroid/display/sessions/:id")
  @ApiOperation({ summary: "Release one display session." })
  @ApiHeader({ name: "x-rebroid-sidecar-secret", required: false })
  @ApiParam({ name: "id", description: "Display session id." })
  @ApiOkResponse({ type: DisplaySessionDto })
  releaseSession(@Param("id") id: string) {
    const session = this.sessions.release(id);
    this.webrtc.stopSession(id);
    this.scrcpy.closeSession(id);
    return session;
  }

  @UseGuards(SidecarAuthGuard)
  @Put("rebroid/display/sessions/:id/clipboard")
  @ApiOperation({ summary: "Set Android clipboard for a display session." })
  @ApiHeader({ name: "x-rebroid-sidecar-secret", required: false })
  @ApiParam({ name: "id", description: "Display session id." })
  @ApiBody({ type: DisplayClipboardDto })
  @ApiOkResponse({ type: DisplayClipboardResultDto })
  async setClipboard(
    @Param("id") id: string,
    @Body() body: DisplayClipboardDto,
  ) {
    const result = await this.controls.execute(id, {
      type: "clipboard",
      text: body.text,
    });
    return {
      text: body.text ?? "",
      supported: true,
      session: this.sessions.getPublic(id),
      ...result,
    };
  }

  @UseGuards(SidecarAuthGuard)
  @Post("rebroid/display/sessions/:id/actions")
  @ApiOperation({
    summary: "Execute a viewer control action for a display session.",
  })
  @ApiHeader({ name: "x-rebroid-sidecar-secret", required: false })
  @ApiParam({ name: "id", description: "Display session id." })
  @ApiBody({ type: DisplayActionDto })
  @ApiOkResponse({ type: DisplayCommandResultDto })
  async action(@Param("id") id: string, @Body() body: DisplayActionDto) {
    return {
      ok: true,
      ...(await this.controls.execute(id, {
        type: "action",
        command: body.command,
      })),
    };
  }

  @UseGuards(SidecarAuthGuard)
  @Get("rebroid/display/sessions/:id/logcat")
  @ApiOperation({
    summary: "Read recent Android logcat output for a display session.",
  })
  @ApiHeader({ name: "x-rebroid-sidecar-secret", required: false })
  @ApiParam({ name: "id", description: "Display session id." })
  @ApiQuery({ name: "tail", required: false, example: 300 })
  @ApiOkResponse({ type: DisplayLogcatDto })
  async logcat(@Param("id") id: string, @Query("tail") tail?: string) {
    const session = this.sessions.get(id);
    const result = await this.adb.logcat(session.udid, Number(tail ?? 300));
    return {
      collectedAt: new Date().toISOString(),
      output: result.stdout,
    };
  }
}
