import {
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { FeatureFlagsService } from '../../../feature-flags/feature-flags.service';
import { MetricsService } from '../../../metrics/metrics.service';
import { ExternalAdbBrokerClient } from './external-adb-broker.client';
import { ExternalAndroidDevicesService } from './external-android-devices.service';

@Injectable()
export class ExternalDeviceViewerService {
  constructor(
    private readonly devices: ExternalAndroidDevicesService,
    private readonly broker: ExternalAdbBrokerClient,
    private readonly features: FeatureFlagsService,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  async target(
    id: string,
    ownerUserId: string,
    attachmentId: string,
    administrator = false,
  ) {
    this.features.assertEnabled('feature.external-devices');
    const device = await this.devices.get(id, {
      userId: ownerUserId,
      administrator,
    });
    if (device.ownerUserId !== ownerUserId)
      throw new NotFoundException('External device not found.');
    if (
      device.connection.state !== 'ready' ||
      device.connection.attachmentId !== attachmentId
    ) {
      this.metrics?.externalStaleAttachment('viewer');
      throw new ConflictException({
        code: 'external_adb_attachment_changed',
        message: 'The device attachment is unavailable.',
      });
    }
    if (!this.broker.enabled)
      throw new NotFoundException('External display is unavailable.');
    return {
      deviceId: device.id,
      ownerUserId: device.ownerUserId,
      attachmentId,
    };
  }

  async open(
    id: string,
    owner: string,
    attachmentId: string,
    grants: string[],
    administrator = false,
  ) {
    await this.target(id, owner, attachmentId, administrator);
    await this.broker.synchronizeViewerFeatures();
    const { session } = await this.broker.createViewer(
      id,
      owner,
      attachmentId,
      ['video', 'audio', ...grants],
    );
    await this.target(id, owner, attachmentId, administrator);
    return {
      id: session.id,
      viewerPath: session.viewerPath,
      audioSupported: session.capabilities.includes('audio'),
    };
  }

  async tool(
    id: string,
    owner: string,
    attachmentId: string,
    tool: 'screenshot' | 'logcat',
    administrator = false,
  ) {
    await this.target(id, owner, attachmentId, administrator);
    const result = await this.broker[tool](id, attachmentId);
    await this.target(id, owner, attachmentId, administrator);
    await this.devices.recordAttachmentActivity(id, attachmentId);
    return result;
  }
}
