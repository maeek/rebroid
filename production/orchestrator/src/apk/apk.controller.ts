import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApkService } from './apk.service';
import { CleanupUploadedApksDto } from './dto/cleanup-uploaded-apks.dto';
import { CleanupUploadedApksResponseDto } from './dto/cleanup-uploaded-apks-response.dto';
import { ListUploadedApksDto } from './dto/list-uploaded-apks.dto';
import { UploadApkDto } from './dto/upload-apk.dto';
import { UploadedApk } from './uploaded-apk.entity';

@ApiTags('apks')
@Controller('apks')
export class ApkController {
  constructor(private readonly apk: ApkService) {}

  @Post()
  @UseInterceptors(FileInterceptor('apk'))
  @ApiConsumes('multipart/form-data')
  @ApiCreatedResponse({ type: UploadedApk })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['apk'],
      properties: {
        ownerUserId: { type: 'string', example: 'admin' },
        apk: { type: 'string', format: 'binary' },
      },
    },
  })
  upload(@Body() dto: UploadApkDto, @UploadedFile() apk: Express.Multer.File) {
    return this.apk.upload(apk, dto.ownerUserId);
  }

  @Get()
  @ApiOkResponse({ type: UploadedApk, isArray: true })
  list(@Query() query: ListUploadedApksDto) {
    return this.apk.list(query.ownerUserId);
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
