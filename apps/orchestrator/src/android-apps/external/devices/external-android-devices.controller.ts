import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBody, ApiHeader, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { externalDeviceVerificationProofs } from '@rebroid/android-application-core/android-device';
import { z } from 'zod';
import {
  ApiOpenAppQuota,
  OpenAppQuota,
} from '../../common/controllers/open-app-quota-header';
import {
  ExternalAndroidDeviceDto,
  ExternalDeviceAvailabilityDto,
  ExternalDeviceCandidateDto,
  ExternalDeviceTcpCheckDto,
  ExternalDeviceVerificationInstructionsDto,
  ExternalTcpEndpointDto,
  ForgottenExternalDeviceDto,
  RegisterExternalAndroidDeviceDto,
  VerifyExternalAndroidDeviceDto,
} from './external-android-device.dto';
import {
  ExternalAndroidDevicesService,
  type ExternalDeviceActor,
} from './external-android-devices.service';

const base = {
  name: z.string().trim().min(2).max(100),
};
const registration = z.discriminatedUnion('transport', [
  z.strictObject({
    ...base,
    transport: z.literal('tcp'),
    endpoint: z.string().max(21),
  }),
  z.strictObject({
    ...base,
    transport: z.literal('usb'),
    candidateId: z.uuid(),
  }),
]);
const verification = z.strictObject({
  attemptId: z.uuid(),
  proof: z.enum(externalDeviceVerificationProofs),
});
const tcpCheck = z.strictObject({ endpoint: z.string().max(21) });
type ActorHeaders = Record<string, string | string[] | undefined>;

const actorFrom = (headers: ActorHeaders): ExternalDeviceActor => {
  const userId = headers['x-rebroid-device-user'];
  if (typeof userId !== 'string' || !userId || userId.length > 200)
    throw new UnauthorizedException('External device account required.');
  return {
    userId,
    administrator: headers['x-rebroid-device-admin'] === 'true',
    canEnroll: headers['x-rebroid-device-enroll'] === 'true',
    canUse: headers['x-rebroid-device-use'] === 'true',
  };
};

@ApiTags('external-devices')
@ApiHeader({ name: 'x-rebroid-device-user', required: true })
@ApiHeader({ name: 'x-rebroid-device-admin', required: false })
@ApiHeader({ name: 'x-rebroid-device-enroll', required: false })
@ApiHeader({ name: 'x-rebroid-device-use', required: false })
@Controller('devices/external')
export class ExternalAndroidDevicesController {
  constructor(private readonly devices: ExternalAndroidDevicesService) {}

  @Get('availability')
  @ApiOkResponse({ type: ExternalDeviceAvailabilityDto })
  availability() {
    return this.devices.availability();
  }

  @Get()
  @ApiOkResponse({ type: ExternalAndroidDeviceDto, isArray: true })
  async list(@Headers() headers: ActorHeaders) {
    return (await this.devices.list(actorFrom(headers))).map(
      ExternalAndroidDeviceDto.fromEntity,
    );
  }

  @Get('usb-candidates')
  @ApiOkResponse({ type: ExternalDeviceCandidateDto, isArray: true })
  candidates(@Headers() headers: ActorHeaders) {
    return this.devices.candidates(actorFrom(headers));
  }

  @Post('tcp-check')
  @HttpCode(200)
  @ApiBody({ type: ExternalTcpEndpointDto })
  @ApiOkResponse({ type: ExternalDeviceTcpCheckDto })
  checkTcp(@Body() body: unknown, @Headers() headers: ActorHeaders) {
    const input = tcpCheck.safeParse(body);
    if (!input.success)
      throw new BadRequestException('Invalid connection target.');
    return this.devices.checkTcpEndpoint(
      input.data.endpoint,
      actorFrom(headers),
    );
  }

  @Post()
  @HttpCode(200)
  @ApiBody({ type: RegisterExternalAndroidDeviceDto })
  @ApiOkResponse({ type: ExternalAndroidDeviceDto })
  async register(@Body() body: unknown, @Headers() headers: ActorHeaders) {
    const input = registration.safeParse(body);
    if (!input.success)
      throw new BadRequestException('Invalid external device registration.');
    return ExternalAndroidDeviceDto.fromEntity(
      await this.devices.register(input.data, actorFrom(headers)),
    );
  }

  @Get(':id')
  @ApiOkResponse({ type: ExternalAndroidDeviceDto })
  async get(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers() headers: ActorHeaders,
  ) {
    return ExternalAndroidDeviceDto.fromEntity(
      await this.devices.get(id, actorFrom(headers)),
    );
  }

  @Post(':id/connect')
  @HttpCode(200)
  @ApiOpenAppQuota()
  @ApiHeader({ name: 'x-rebroid-max-session-seconds', required: false })
  @ApiOkResponse({ type: ExternalAndroidDeviceDto })
  async connect(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers() headers: ActorHeaders,
    @OpenAppQuota() maxOpenDevices?: number,
    @Headers('x-rebroid-max-session-seconds') maxSessionSeconds?: string,
  ) {
    const timeout = z.coerce
      .number()
      .int()
      .min(0)
      .max(Number.MAX_SAFE_INTEGER)
      .optional()
      .safeParse(maxSessionSeconds);
    if (!timeout.success)
      throw new BadRequestException('Invalid session timeout.');
    return ExternalAndroidDeviceDto.fromEntity(
      await this.devices.connect(
        id,
        actorFrom(headers),
        maxOpenDevices,
        timeout.data,
      ),
    );
  }

  @Post(':id/refresh')
  @HttpCode(200)
  @ApiOkResponse({ type: ExternalAndroidDeviceDto })
  async refresh(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers() headers: ActorHeaders,
  ) {
    return ExternalAndroidDeviceDto.fromEntity(
      await this.devices.refresh(id, actorFrom(headers)),
    );
  }

  @Get(':id/verification')
  @ApiOkResponse({ type: ExternalDeviceVerificationInstructionsDto })
  instructions(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('attemptId', ParseUUIDPipe) attemptId: string,
    @Headers() headers: ActorHeaders,
  ) {
    return this.devices.instructions(id, attemptId, actorFrom(headers));
  }

  @Post(':id/verify')
  @HttpCode(200)
  @ApiBody({ type: VerifyExternalAndroidDeviceDto })
  @ApiOkResponse({ type: ExternalAndroidDeviceDto })
  async verify(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @Headers() headers: ActorHeaders,
  ) {
    const input = verification.safeParse(body);
    if (!input.success)
      throw new BadRequestException('Invalid verification request.');
    return ExternalAndroidDeviceDto.fromEntity(
      await this.devices.verify(
        id,
        input.data.attemptId,
        input.data.proof,
        actorFrom(headers),
      ),
    );
  }

  @Post(':id/disconnect')
  @HttpCode(200)
  @ApiOkResponse({ type: ExternalAndroidDeviceDto })
  async disconnect(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers() headers: ActorHeaders,
  ) {
    return ExternalAndroidDeviceDto.fromEntity(
      await this.devices.disconnect(id, actorFrom(headers)),
    );
  }

  @Delete(':id')
  @ApiOkResponse({ type: ForgottenExternalDeviceDto })
  forget(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers() headers: ActorHeaders,
  ) {
    return this.devices.forget(id, actorFrom(headers));
  }
}
