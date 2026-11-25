import {
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { ExternalAutomationOperation } from '@rebroid/android-application-core/android-device';
import { type Repository } from 'typeorm';
import { z } from 'zod';
import { MetricsService } from '../../../metrics/metrics.service';
import type {
  AndroidAutomationAdapters,
  AndroidAutomationApplication,
  ExternalAutomationApplication,
} from '../../contracts/android-apps-automation.port';
import { ExternalAdbBrokerClient } from './external-adb-broker.client';
import { ExternalAndroidDevice } from './external-android-device.entity';
import { ExternalAndroidDevicesService } from './external-android-devices.service';

const unavailable = () =>
  new ConflictException({
    code: 'external_adb_attachment_changed',
    message:
      'This workflow requires the external attachment that was verified when it was queued.',
  });
const unsupported = () =>
  Promise.reject(
    new ConflictException('This operation requires a managed device.'),
  );
const executed = z.object({ executed: z.literal(true) });
const clipboard = z.object({ text: z.string(), supported: z.boolean() });

@Injectable()
export class ExternalAutomationDeviceService {
  constructor(
    @InjectRepository(ExternalAndroidDevice)
    private readonly devices: Repository<ExternalAndroidDevice>,
    private readonly broker: ExternalAdbBrokerClient,
    private readonly registrations: ExternalAndroidDevicesService,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  async find(id: string): Promise<ExternalAutomationApplication | null> {
    const device = await this.devices.findOneBy({ id });
    if (!device) return null;
    return {
      id,
      kind: 'external',
      ownerUserId: device.ownerUserId,
      attachmentId: device.connection.attachmentId,
    };
  }

  async assertCurrent(
    expected: ExternalAutomationApplication,
    signal?: AbortSignal,
  ) {
    signal?.throwIfAborted();
    this.registrations.assertEnabled();
    const device = await this.devices.findOneBy({ id: expected.id });
    if (!device || device.ownerUserId !== expected.ownerUserId)
      throw new NotFoundException('Target device not found.');
    if (
      !expected.attachmentId ||
      device.connection.state !== 'ready' ||
      expected.attachmentId !== device.connection.attachmentId ||
      !device.attemptId
    ) {
      this.metrics?.externalStaleAttachment('automation');
      throw unavailable();
    }
    const observation = await this.broker.inspect(
      device.id,
      device.attemptId,
      signal,
    );
    if (
      observation.state !== 'ready' ||
      observation.attachmentId !== expected.attachmentId
    ) {
      this.metrics?.externalStaleAttachment('automation');
      throw unavailable();
    }
    signal?.throwIfAborted();
    await this.registrations.recordAttachmentActivity(
      device.id,
      expected.attachmentId,
    );
    return { ...expected, attachmentId: expected.attachmentId };
  }

  adapters(): AndroidAutomationAdapters {
    const attachment = (app: AndroidAutomationApplication) => {
      if (app.kind !== 'external' || !app.attachmentId) throw unavailable();
      return app.attachmentId;
    };
    const send = <T>(
      app: AndroidAutomationApplication,
      input: ExternalAutomationOperation,
      schema: z.ZodType<T>,
      signal?: AbortSignal,
    ) => this.broker.automate(app.id, attachment(app), input, schema, signal);
    return {
      adb: {
        tap: (app, x, y, signal) =>
          send(app, { operation: 'tap', x, y }, executed, signal),
        swipe: (app, points, signal) =>
          send(app, { operation: 'swipe', ...points }, executed, signal),
        inputText: (app, text, signal) =>
          send(app, { operation: 'text', text }, executed, signal),
        key: (app, key, signal) =>
          send(app, { operation: 'key', key }, executed, signal),
        setClipboard: (app, text, signal) =>
          send(app, { operation: 'writeClipboard', text }, clipboard, signal),
        getClipboard: (app, signal) =>
          send(app, { operation: 'readClipboard' }, clipboard, signal),
        launchPackage: (app, packageName, signal) =>
          send(
            app,
            { operation: 'launch', packageName },
            z.object({ installed: z.boolean(), launched: z.boolean() }),
            signal,
          ),
        screenshot: async (app, signal) => {
          const { pngBase64 } = await this.broker.screenshot(
            app.id,
            attachment(app),
            signal,
          );
          return {
            mimeType: 'image/png',
            dataUrl: `data:image/png;base64,${pngBase64}`,
            capturedAt: new Date().toISOString(),
          };
        },
        dumpUi: async (app, signal) => ({
          ...(await send(
            app,
            { operation: 'dumpUi' },
            z.object({
              status: z.enum(['available', 'failed']),
              xml: z
                .string()
                .max(2 * 1024 * 1024)
                .optional(),
            }),
            signal,
          )),
          dumpedAt: new Date().toISOString(),
        }),
        uiText: unsupported,
        rotateDisplay: unsupported,
        shell: unsupported,
        pushFile: unsupported,
        pullFile: unsupported,
        deleteFile: unsupported,
        fileExists: unsupported,
        listFiles: unsupported,
      },
      display: {
        viewerControl: async (app, command, signal) => {
          await send(app, { operation: 'viewer', command }, executed, signal);
          return {
            command,
            executed: true,
            session: { id: attachment(app), surfaceId: 'main' },
          };
        },
      },
      networkPolicy: {
        updateNetworkPolicy: unsupported,
        changeAllowedCidr: unsupported,
      },
    };
  }
}
