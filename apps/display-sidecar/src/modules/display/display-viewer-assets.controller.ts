import { Controller, Get, Param, Res } from "@nestjs/common";
import { ApiExcludeEndpoint } from "@nestjs/swagger";
import type { FastifyReply } from "fastify";
import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import { basename, extname, join } from "node:path";

const viewerDirectory = join(__dirname, "viewer");
const assetContentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};
const viewerContentSecurityPolicy =
  "frame-ancestors 'self'; object-src 'none'; base-uri 'none'";

@Controller("viewer/display")
export class DisplayViewerAssetsController {
  @Get()
  @ApiExcludeEndpoint()
  viewer(@Res() response: FastifyReply) {
    response.header("Content-Security-Policy", viewerContentSecurityPolicy);
    return this.sendFile(
      response,
      join(viewerDirectory, "index.html"),
      "text/html; charset=utf-8",
      500,
      "The live display viewer is not available.",
    );
  }

  @Get("assets/:file")
  @ApiExcludeEndpoint()
  async asset(@Param("file") file: string, @Res() response: FastifyReply) {
    const safeFile = basename(file);
    const contentType = assetContentTypes[extname(safeFile)];
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
