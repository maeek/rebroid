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
} from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ExternalAdbBrokerClient } from './external-adb-broker.client';
import { ExternalAndroidDevicesService } from './external-android-devices.service';

const owners = z.strictObject({
  ownerUserIds: z.array(z.string().min(1).max(200)).min(1).max(256),
});

class ExternalAdminSessionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ['external'] }) provider!: 'external';
  @ApiProperty({ type: String, nullable: true }) applicationId!: string | null;
  @ApiProperty({ type: String, nullable: true }) deviceName!: string | null;
  @ApiProperty({ type: String, nullable: true }) ownerUserId!: string | null;
  @ApiProperty({ enum: ['created', 'active', 'released', 'expired'] })
  status!: 'created' | 'active' | 'released' | 'expired';
  @ApiProperty() createdAt!: string;
  @ApiProperty() lastActivityAt!: string;
  @ApiProperty() expiresAt!: string;
  @ApiProperty({ type: [String] }) capabilities!: string[];
}

class ExternalViewerRevocationDto {
  @ApiProperty() released!: number;
}

class ExternalViewerOwnersDto {
  @ApiProperty({ type: [String] }) ownerUserIds!: string[];
}

function presentSession(
  session: Awaited<ReturnType<ExternalAdbBrokerClient['releaseViewer']>>,
  deviceName: string | null,
): ExternalAdminSessionDto {
  return {
    id: session.id,
    provider: 'external',
    applicationId: session.appId ?? null,
    ownerUserId: session.ownerUserId ?? null,
    deviceName,
    status: session.status,
    createdAt: session.createdAt,
    lastActivityAt: session.lastActivityAt,
    expiresAt: session.expiresAt,
    capabilities: session.capabilities,
  };
}

@ApiTags('external-devices')
@Controller('devices/external/viewer-sessions')
export class ExternalViewerAdministrationController {
  constructor(
    private readonly broker: ExternalAdbBrokerClient,
    private readonly devices: ExternalAndroidDevicesService,
  ) {}

  @Get()
  @ApiOkResponse({ type: ExternalAdminSessionDto, isArray: true })
  async list() {
    if (!this.broker.enabled) return [];
    const [{ items }, devices] = await Promise.all([
      this.broker.listViewers(),
      this.devices.list({ userId: 'casting', administrator: true }),
    ]);
    const names = new Map(devices.map((device) => [device.id, device.name]));
    return items.map((item) =>
      presentSession(item, names.get(item.appId ?? '') ?? null),
    );
  }

  @Delete(':id')
  @ApiOkResponse({ type: ExternalAdminSessionDto })
  async release(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ExternalAdminSessionDto> {
    return presentSession(await this.broker.releaseViewer(id), null);
  }

  @Post('revoke')
  @HttpCode(200)
  @ApiBody({ type: ExternalViewerOwnersDto })
  @ApiOkResponse({ type: ExternalViewerRevocationDto })
  revoke(@Body() body: unknown) {
    const input = owners.safeParse(body);
    if (!input.success)
      throw new BadRequestException('Viewer owners are required.');
    return this.broker.enabled
      ? this.broker.revokeViewers(input.data.ownerUserIds)
      : { released: 0 };
  }
}
