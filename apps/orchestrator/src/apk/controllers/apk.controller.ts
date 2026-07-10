import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { CleanupUploadedApksResponseDto } from '../dto/cleanup-uploaded-apks-response.dto';
import { CleanupUploadedApksDto } from '../dto/cleanup-uploaded-apks.dto';
import { ListUploadedApksDto } from '../dto/list-uploaded-apks.dto';
import { LookupUploadedApkDto } from '../dto/lookup-uploaded-apk.dto';
import { UploadApkDto } from '../dto/upload-apk.dto';
import { UploadedApkResponseDto } from '../dto/uploaded-apk-response.dto';
import { ApkCatalogService } from '../services/apk-catalog.service';

@ApiTags('apk-uploads')
@Controller('apk-uploads')
export class ApkController {
  constructor(private readonly apk: ApkCatalogService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiCreatedResponse({ type: UploadedApkResponseDto })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['apk'],
      properties: {
        apk: { type: 'string', format: 'binary' },
      },
    },
  })
  async upload(@Req() request: FastifyRequest, @Query() dto: UploadApkDto) {
    return UploadedApkResponseDto.fromEntity(
      await this.apk.upload(request.raw, dto.ownerUserId),
    );
  }

  @Get()
  @ApiOkResponse({ type: UploadedApkResponseDto, isArray: true })
  async list(@Query() query: ListUploadedApksDto) {
    return (await this.apk.list(query.ownerUserId)).map((upload) =>
      UploadedApkResponseDto.fromEntity(upload),
    );
  }

  @Get('lookup')
  @ApiOkResponse({ type: UploadedApkResponseDto })
  async lookup(@Query() query: LookupUploadedApkDto) {
    const upload = await this.apk.findBySha256(query.sha256, query.ownerUserId);
    return upload ? UploadedApkResponseDto.fromEntity(upload) : null;
  }

  @Delete(':id')
  @ApiOkResponse({ type: UploadedApkResponseDto })
  async remove(@Param('id') id: string) {
    return UploadedApkResponseDto.fromEntity(await this.apk.remove(id));
  }

  @Post('cleanup')
  @ApiOkResponse({ type: CleanupUploadedApksResponseDto })
  cleanup(@Body() dto: CleanupUploadedApksDto) {
    return this.apk.cleanupUnused(dto.ownerUserId);
  }
}
