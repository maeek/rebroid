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
import type { Request } from 'express';
import { CleanupUploadedApksResponseDto } from '../dto/cleanup-uploaded-apks-response.dto';
import { CleanupUploadedApksDto } from '../dto/cleanup-uploaded-apks.dto';
import { ListUploadedApksDto } from '../dto/list-uploaded-apks.dto';
import { LookupUploadedApkDto } from '../dto/lookup-uploaded-apk.dto';
import { UploadApkDto } from '../dto/upload-apk.dto';
import { UploadedApk } from '../entities/uploaded-apk.entity';
import { ApkCatalogService } from '../services/apk-catalog.service';

@ApiTags('apks')
@Controller('apks')
export class ApkController {
  constructor(private readonly apk: ApkCatalogService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiCreatedResponse({ type: UploadedApk })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['apk'],
      properties: {
        apk: { type: 'string', format: 'binary' },
      },
    },
  })
  upload(@Req() request: Request, @Query() dto: UploadApkDto) {
    return this.apk.upload(request, dto.ownerUserId);
  }

  @Get()
  @ApiOkResponse({ type: UploadedApk, isArray: true })
  list(@Query() query: ListUploadedApksDto) {
    return this.apk.list(query.ownerUserId);
  }

  @Get('lookup')
  @ApiOkResponse({ type: UploadedApk })
  lookup(@Query() query: LookupUploadedApkDto) {
    return this.apk.findBySha256(query.sha256, query.ownerUserId);
  }

  @Delete(':id')
  @ApiOkResponse({ type: UploadedApk })
  remove(@Param('id') id: string) {
    return this.apk.remove(id);
  }

  @Post('cleanup')
  @ApiOkResponse({ type: CleanupUploadedApksResponseDto })
  cleanup(@Body() dto: CleanupUploadedApksDto) {
    return this.apk.cleanupUnused(dto.ownerUserId);
  }
}
