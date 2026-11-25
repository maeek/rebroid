import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBody, ApiOkResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { SidecarAuthGuard } from "../shared/sidecar-auth.guard";
import { ExternalAdbAttachments } from "./external-adb-attachments";
import {
  ExternalAdbCandidateDto,
  ExternalAdbConnectionDto,
  ExternalAdbDetachedDto,
  ExternalAdbInstructionsDto,
  ExternalAdbSelectorDto,
  ExternalAdbTcpCheckDto,
} from "./external-adb.dto";

const connectSchema = z.discriminatedUnion("transport", [
  z.strictObject({
    transport: z.literal("usb"),
    selector: z.string().regex(/^[a-f0-9]{64}$/),
  }),
  z.strictObject({ transport: z.literal("tcp"), selector: z.string().max(21) }),
]);
const proofs = ["physical", "challenge", "android_prompt"] as const;
const tcpCheckSchema = z.strictObject({ endpoint: z.string().max(21) });

@ApiTags("external-adb")
@ApiSecurity("sidecar-secret")
@UseGuards(SidecarAuthGuard)
@Controller("rebroid/external-adb")
export class ExternalAdbController {
  constructor(private readonly attachments: ExternalAdbAttachments) {}

  @Get("candidates")
  @ApiOkResponse({ type: ExternalAdbCandidateDto, isArray: true })
  candidates() {
    return this.attachments.listCandidates();
  }

  @Get("candidates/:id")
  @ApiOkResponse({ type: ExternalAdbSelectorDto })
  candidate(@Param("id", ParseUUIDPipe) id: string) {
    return this.attachments.resolveCandidate(id);
  }

  @Post("tcp-check")
  @HttpCode(200)
  @ApiBody({
    schema: {
      type: "object",
      required: ["endpoint"],
      properties: { endpoint: { type: "string" } },
    },
  })
  @ApiOkResponse({ type: ExternalAdbTcpCheckDto })
  checkTcp(@Body() body: unknown) {
    const input = tcpCheckSchema.safeParse(body);
    if (!input.success)
      throw new BadRequestException("Invalid connection target.");
    return this.attachments.checkTcpEndpoint(input.data.endpoint);
  }

  @Post("devices/:id/attempts/:attemptId")
  @HttpCode(200)
  @ApiBody({
    schema: {
      type: "object",
      required: ["transport", "selector"],
      properties: {
        transport: { type: "string", enum: ["usb", "tcp"] },
        selector: { type: "string" },
      },
    },
  })
  @ApiOkResponse({ type: ExternalAdbConnectionDto })
  connect(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("attemptId", ParseUUIDPipe) attemptId: string,
    @Body() body: unknown,
  ) {
    const input = connectSchema.safeParse(body);
    if (!input.success)
      throw new BadRequestException("Invalid connection target.");
    return this.attachments.connect(
      id,
      attemptId,
      input.data.transport,
      input.data.selector,
    );
  }

  @Get("devices/:id/attempts/:attemptId")
  @ApiOkResponse({ type: ExternalAdbConnectionDto })
  inspect(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("attemptId", ParseUUIDPipe) attemptId: string,
  ) {
    return this.attachments.inspect(id, attemptId);
  }

  @Get("devices/:id/attempts/:attemptId/instructions")
  @ApiOkResponse({ type: ExternalAdbInstructionsDto })
  instructions(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("attemptId", ParseUUIDPipe) attemptId: string,
  ) {
    return this.attachments.instructions(id, attemptId);
  }

  @Post("devices/:id/attempts/:attemptId/verify")
  @HttpCode(200)
  @ApiBody({
    schema: {
      type: "object",
      required: ["proof"],
      properties: { proof: { type: "string", enum: [...proofs] } },
    },
  })
  @ApiOkResponse({ type: ExternalAdbConnectionDto })
  verify(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("attemptId", ParseUUIDPipe) attemptId: string,
    @Body() body: unknown,
  ) {
    const input = z.strictObject({ proof: z.enum(proofs) }).safeParse(body);
    if (!input.success)
      throw new BadRequestException("Invalid verification proof.");
    return this.attachments.verify(id, attemptId, input.data.proof);
  }

  @Delete("devices/:id/attempts/:attemptId")
  @ApiOkResponse({ type: ExternalAdbDetachedDto })
  detach(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("attemptId", ParseUUIDPipe) attemptId: string,
  ) {
    return this.attachments.detach(id, attemptId);
  }
}
