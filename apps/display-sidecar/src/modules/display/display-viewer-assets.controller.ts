import { SidecarFeatureService } from "../shared/sidecar-feature.service";
import { Controller, Get, Optional, Param, Res } from "@nestjs/common";
import { SidecarConfigService } from "../shared/sidecar-config.service";
import { ApiExcludeEndpoint } from "@nestjs/swagger";
import type { FastifyReply } from "fastify";
import { createReadStream } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";

const viewerDirectory = join(__dirname, "viewer");
const assetContentTypes: Record<string, string> = {
  ".js": "text/javascript; charset=utf-8",
};
const viewerContentSecurityPolicy =
  "frame-ancestors 'self'; object-src 'none'; base-uri 'none'";

@Controller("viewer/display")
export class DisplayViewerAssetsController {
  constructor(
    private readonly features: SidecarFeatureService,
    @Optional() private readonly config?: SidecarConfigService,
  ) {}

  @Get()
  @ApiExcludeEndpoint()
  async viewer(@Res() response: FastifyReply) {
    response.header("Content-Security-Policy", viewerContentSecurityPolicy);
    response.header("Cache-Control", "no-store");
    let html: string;
    try {
      html = await readFile(join(viewerDirectory, "index.html"), "utf8");
    } catch {
      response.status(500).send("The live display viewer is not available.");
      return;
    }
    if (!this.features.isWebrtcEnabled()) {
      html = html.replace("<body>", '<body data-webrtc-disabled="true">');
    }
    if (this.config?.externalAdbEnabled) {
      html = html.replaceAll(
        'src="/viewer/display/',
        'src="/external-display/viewer/display/',
      );
    }
    response.type("text/html; charset=utf-8").send(html);
  }

  @Get("assets/:file")
  @ApiExcludeEndpoint()
  async asset(@Param("file") file: string, @Res() response: FastifyReply) {
    const safeFile = basename(file);
    const contentType =
      safeFile === "device.webp"
        ? "image/webp"
        : assetContentTypes[extname(safeFile)];
    if (!contentType || safeFile !== file) {
      response.status(404).send("Not found.");
      return;
    }
    await this.sendFile(
      response,
      join(viewerDirectory, "assets", safeFile),
      contentType,
      404,
      "Not found.",
    );
  }

  private async sendFile(
    response: FastifyReply,
    filePath: string,
    contentType: string,
    errorStatus: number,
    errorMessage: string,
  ) {
    try {
      await access(filePath);
    } catch {
      response.status(errorStatus).send(errorMessage);
      return;
    }
    response.type(contentType).send(createReadStream(filePath));
  }
}
