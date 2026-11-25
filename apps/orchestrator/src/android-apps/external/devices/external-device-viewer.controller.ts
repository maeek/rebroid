import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBody,
  ApiHeader,
  ApiOkResponse,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { z } from 'zod';
import { ExternalDeviceViewerService } from './external-device-viewer.service';

const grants = ['control', 'clipboard', 'screenshot'] as const;
const viewerInput = z.strictObject({
  attachmentId: z.uuid(),
  grants: z.array(z.enum(grants)).max(grants.length),
});

class ExternalViewerTargetDto {
  @ApiProperty({ format: 'uuid' }) deviceId!: string;
  @ApiProperty() ownerUserId!: string;
  @ApiProperty({ format: 'uuid' }) attachmentId!: string;
}

class ExternalViewerInputDto {
  @ApiProperty({ format: 'uuid' }) attachmentId!: string;
  @ApiProperty({ enum: grants, isArray: true }) grants!: string[];
}

class ExternalViewerSessionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() viewerPath!: string;
  @ApiProperty() audioSupported!: boolean;
}

class ExternalViewerScreenshotDto {
  @ApiProperty() pngBase64!: string;
}

class ExternalViewerLogcatDto {
  @ApiProperty({ format: 'date-time' }) collectedAt!: string;
  @ApiProperty() output!: string;
}

const ownerFrom = (id?: string, canUse?: string) => {
  if (!id || id.length > 200)
    throw new UnauthorizedException('External device owner required.');
  if (canUse !== 'true')
    throw new ForbiddenException('External device use permission is required.');
  return id;
};

@ApiTags('external-devices')
@ApiHeader({ name: 'x-rebroid-device-user', required: true })
@ApiHeader({ name: 'x-rebroid-device-use', required: true })
@ApiHeader({ name: 'x-rebroid-device-admin', required: false })
@Controller('devices/external/:id')
export class ExternalDeviceViewerController {
  constructor(private readonly viewer: ExternalDeviceViewerService) {}

  @Get('attachments/:attachmentId')
  @ApiOkResponse({ type: ExternalViewerTargetDto })
  target(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Headers('x-rebroid-device-user') owner?: string,
    @Headers('x-rebroid-device-use') canUse?: string,
    @Headers('x-rebroid-device-admin') administrator?: string,
  ) {
    return this.viewer.target(
      id,
      ownerFrom(owner, canUse),
      attachmentId,
      administrator === 'true',
    );
  }

  @Post('viewer')
  @HttpCode(200)
  @ApiBody({ type: ExternalViewerInputDto })
  @ApiOkResponse({ type: ExternalViewerSessionDto })
  open(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @Headers('x-rebroid-device-user') owner?: string,
    @Headers('x-rebroid-device-use') canUse?: string,
    @Headers('x-rebroid-device-admin') administrator?: string,
  ) {
    const input = viewerInput.safeParse(body);
    if (!input.success)
      throw new BadRequestException('A verified attachment is required.');
    return this.viewer.open(
      id,
      ownerFrom(owner, canUse),
      input.data.attachmentId,
      input.data.grants,
      administrator === 'true',
    );
  }

  @Get('attachments/:attachmentId/screenshot')
  @ApiOkResponse({ type: ExternalViewerScreenshotDto })
  screenshot(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Headers('x-rebroid-device-user') owner?: string,
    @Headers('x-rebroid-device-use') canUse?: string,
    @Headers('x-rebroid-device-admin') administrator?: string,
  ) {
    return this.viewer.tool(
      id,
      ownerFrom(owner, canUse),
      attachmentId,
      'screenshot',
      administrator === 'true',
    );
  }

  @Get('attachments/:attachmentId/logcat')
  @ApiOkResponse({ type: ExternalViewerLogcatDto })
  logcat(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Headers('x-rebroid-device-user') owner?: string,
    @Headers('x-rebroid-device-use') canUse?: string,
    @Headers('x-rebroid-device-admin') administrator?: string,
  ) {
    return this.viewer.tool(
      id,
      ownerFrom(owner, canUse),
      attachmentId,
      'logcat',
      administrator === 'true',
    );
  }
}
