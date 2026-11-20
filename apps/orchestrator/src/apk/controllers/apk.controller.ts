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
import {
  ApkLibraryEntryDto,
  ApkLibraryMutationDto,
  ApkLibraryMutationResultDto,
} from '../dto/apk-library.dto';
import { ListUploadedApksDto } from '../dto/list-uploaded-apks.dto';
import { LookupUploadedApkDto } from '../dto/lookup-uploaded-apk.dto';
import { UploadApkDto } from '../dto/upload-apk.dto';
import { UploadedApkResponseDto } from '../dto/uploaded-apk-response.dto';
import { ApkCatalogService } from '../services/apk-catalog.service';
import { ApkLibraryService } from '../services/apk-library.service';

@ApiTags('apk-uploads')
@Controller('apk-uploads')
export class ApkController {
  constructor(
    private readonly apk: ApkCatalogService,
    private readonly library: ApkLibraryService,
  ) {}

  @Get('library')
  @ApiOkResponse({ type: [ApkLibraryEntryDto] })
  listLibrary() {
    return this.library.list();
  }

  @Post('library')
  @ApiCreatedResponse({ type: ApkLibraryMutationResultDto })
  mutateLibrary(@Body() input: ApkLibraryMutationDto) {
    return this.library.mutate(input);
  }

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

  @Get('selection/:id')
  @ApiOkResponse({ type: UploadedApkResponseDto })
  async selection(
    @Param('id') id: string,
    @Query() query: ListUploadedApksDto,
  ) {
    const upload = await this.apk.getForOwner(id, query.ownerUserId);
    return UploadedApkResponseDto.fromEntity(upload);
  }

  @Delete(':id')
  @ApiOkResponse({ type: UploadedApkResponseDto })
  async remove(@Param('id') id: string) {
    return UploadedApkResponseDto.fromEntity(await this.apk.remove(id));
  }
}
