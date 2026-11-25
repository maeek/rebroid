import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import {
  isExternalAdbTcpEndpoint,
  type ExternalDeviceConnection,
  type ExternalDeviceVerificationProof,
} from '@rebroid/android-application-core/android-device';
import { randomUUID } from 'node:crypto';
import { IsNull, Not, type EntityManager, type Repository } from 'typeorm';
import { ExternalAdbBrokerClient } from './external-adb-broker.client';
import { MetricsService } from '../../../metrics/metrics.service';
import { ExternalAndroidDevice } from './external-android-device.entity';
import type {
  ExternalDeviceAvailabilityDto,
  ExternalDeviceTcpCheckDto,
} from './external-android-device.dto';
import { FeatureFlagsService } from '../../../feature-flags/feature-flags.service';
import { SettingsService } from '../../../settings/settings.service';
import { assertOpenDeviceSlot } from '../../common/services/open-device-quota';
import type { ExternalAttachmentReservationPort } from '../../contracts/external-attachment-reservation.port';

export interface ExternalDeviceActor {
  userId: string;
  administrator: boolean;
  canEnroll?: boolean;
  canUse?: boolean;
}

type RegisterExternalDevice = { name: string } & (
  | { transport: 'tcp'; endpoint: string }
  | { transport: 'usb'; candidateId: string }
);

const disconnected = (): ExternalDeviceConnection => ({
  attemptId: null,
  attachmentId: null,
  state: 'disconnected',
  failure: null,
  observedAt: null,
});

@Injectable()
export class ExternalAndroidDevicesService
  implements OnModuleInit, ExternalAttachmentReservationPort
{
  private readonly inflight = new Set<string>();

  constructor(
    @InjectRepository(ExternalAndroidDevice)
    private readonly devices: Repository<ExternalAndroidDevice>,
    private readonly broker: ExternalAdbBrokerClient,
    private readonly config: ConfigService,
    @Optional() private readonly features?: FeatureFlagsService,
    @Optional() private readonly settings?: SettingsService,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  async onModuleInit() {
    await this.devices.update(
      { attemptId: Not(IsNull()) },
      {
        connection: {
          ...disconnected(),
          state: 'offline',
          failure: 'verification_required',
          observedAt: new Date().toISOString(),
        },
      },
    );
  }

  @Cron('*/5 * * * * *', {
    name: 'external-adb-observations',
    waitForCompletion: true,
  })
  async synchronize() {
    const devices = await this.activeDevices();
    if (!devices.length) return;
    const inactivity =
      (await this.settings?.getSettings())?.defaultInactivityTimeoutSeconds ??
      0;
    const quotaEnabled = this.features?.isEnabled('feature.resource-quota');
    const timeoutFor = (device: ExternalAndroidDevice) =>
      Math.min(
        inactivity > 0 ? inactivity : Infinity,
        quotaEnabled ? (device.maxSessionSeconds ?? Infinity) : Infinity,
      );
    const activity = new Map<string, number>();
    if (
      devices.some(
        (device) =>
          device.connection.state === 'ready' &&
          Number.isFinite(timeoutFor(device)),
      )
    ) {
      const viewers = await this.broker
        .listViewers()
        .catch(() => ({ items: [] }));
      for (const viewer of viewers.items) {
        if (!viewer.runtimeId) continue;
        const previous = activity.get(viewer.runtimeId) ?? 0;
        activity.set(
          viewer.runtimeId,
          Math.max(previous, Date.parse(viewer.lastActivityAt)),
        );
      }
    }
    for (let offset = 0; offset < devices.length; offset += 8) {
      await Promise.all(
        devices.slice(offset, offset + 8).map(async (device) => {
          if (this.inflight.has(device.id)) return;
          await this.exclusive(device.id, async () => {
            const current = await this.devices.findOneBy({ id: device.id });
            if (!current?.attemptId) return;
            if (!this.isEnabled()) {
              await this.invalidate(current, 'verification_required');
              return;
            }
            const timeout = timeoutFor(current);
            if (
              Number.isFinite(timeout) &&
              current.connection.state === 'ready' &&
              current.connection.attachmentId
            ) {
              const lastActivity = Math.max(
                current.lastActivityAt?.getTime() ?? 0,
                activity.get(current.connection.attachmentId) ?? 0,
              );
              if (
                lastActivity &&
                Date.now() - lastActivity >= timeout * 1_000
              ) {
                await this.invalidate(current, 'attempt_expired');
                return;
              }
            }
            if (current.connection.state === 'offline')
              await this.invalidate(current);
            else await this.observe(current);
          });
        }),
      );
    }
  }

  async availability(): Promise<ExternalDeviceAvailabilityDto> {
    if (!this.broker.enabled)
      return { enabled: false, status: 'not_configured' };
    if (!this.isEnabled())
      return { enabled: false, status: 'feature_disabled' };
    try {
      const signal = AbortSignal.timeout(1500);
      await Promise.all([
        this.broker.checkReadiness(signal),
        this.broker.synchronizeViewerFeatures(signal),
      ]);
    } catch {
      return { enabled: false, status: 'broker_unavailable' };
    }
    return this.isEnabled()
      ? { enabled: true, status: 'available' }
      : { enabled: false, status: 'feature_disabled' };
  }

  private isEnabled() {
    return (
      this.broker.enabled &&
      (this.features?.isEnabled('feature.external-devices') ?? false)
    );
  }

  assertEnabled() {
    this.features?.assertEnabled('feature.external-devices');
    if (!this.isEnabled())
      throw new ForbiddenException('External ADB is disabled.');
  }

  list(actor: ExternalDeviceActor) {
    return this.devices.find({
      where: actor.administrator
        ? [
            { transport: 'tcp' },
            { transport: 'usb', ownerUserId: actor.userId },
          ]
        : { transport: 'tcp', ownerUserId: actor.userId },
      order: { createdAt: 'DESC' },
    });
  }

  async readOwnedAttachmentId(
    transaction: EntityManager,
    deviceId: string,
    ownerUserId: string,
  ) {
    const device = await transaction
      .getRepository(ExternalAndroidDevice)
      .findOne({
        where: { id: deviceId, ownerUserId },
        select: { connection: true },
      });
    return device?.connection.attachmentId ?? null;
  }

  async get(id: string, actor: ExternalDeviceActor) {
    const device = await this.devices.findOneBy({ id });
    if (
      !device ||
      (!actor.administrator &&
        (device.transport === 'usb' || actor.userId !== device.ownerUserId))
    ) {
      throw new NotFoundException('External device not found.');
    }
    return device;
  }

  async candidates(actor: ExternalDeviceActor) {
    this.requireEnrollment(actor);
    this.requireUsbAdministrator(actor);
    this.assertEnabled();
    await this.broker.synchronizeViewerFeatures();
    return this.broker.listCandidates();
  }

  async checkTcpEndpoint(
    endpoint: string,
    actor: ExternalDeviceActor,
  ): Promise<ExternalDeviceTcpCheckDto> {
    this.requireEnrollment(actor);
    this.assertEnabled();
    if (!this.isApprovedTcpEndpoint(endpoint)) return { status: 'not_allowed' };

    const signal = AbortSignal.timeout(4_000);
    try {
      await this.broker.synchronizeViewerFeatures(signal);
      return await this.broker.checkTcpEndpoint(endpoint, signal);
    } catch (error) {
      if (signal.aborted)
        throw new ServiceUnavailableException(
          'The ADB broker did not respond.',
        );
      throw error;
    }
  }

  async register(input: RegisterExternalDevice, actor: ExternalDeviceActor) {
    this.requireEnrollment(actor);
    this.assertEnabled();
    let selector: string;
    if (input.transport === 'usb') {
      this.requireUsbAdministrator(actor);
      await this.broker.synchronizeViewerFeatures();
      selector = (await this.broker.resolveCandidate(input.candidateId))
        .selector;
    } else {
      selector = input.endpoint;
      if (!this.isApprovedTcpEndpoint(selector)) {
        throw new BadRequestException({
          code: 'external_adb_endpoint_forbidden',
          message: 'Select an approved TCP endpoint.',
        });
      }
    }
    const device = this.devices.create({
      id: randomUUID(),
      ownerUserId: actor.userId,
      name: input.name,
      transport: input.transport,
      selector,
      attemptId: null,
      connection: disconnected(),
    });
    try {
      await this.devices.insert(device);
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'SQLITE_CONSTRAINT_UNIQUE'
      ) {
        throw new ConflictException({
          code: 'external_adb_already_registered',
          message: 'This device is already registered.',
        });
      }
      throw error;
    }
    return this.devices.findOneByOrFail({ id: device.id });
  }

  private isApprovedTcpEndpoint(endpoint: string) {
    const approved =
      this.config.get<string[]>('app.externalAdb.tcpEndpoints') ?? [];
    return isExternalAdbTcpEndpoint(endpoint) && approved.includes(endpoint);
  }

  connect(
    id: string,
    actor: ExternalDeviceActor,
    maxOpenDevices?: number,
    maxSessionSeconds?: number,
  ) {
    return this.exclusive(id, async () => {
      this.requireUse(actor);
      const device = await this.getForConnection(id, actor);
      this.assertEnabled();
      await this.broker.synchronizeViewerFeatures();
      if (device.attemptId && device.connection.state !== 'offline')
        return this.observe(device);
      if (device.attemptId) await this.detach(device);
      const attemptId = randomUUID();
      const connection: ExternalDeviceConnection = {
        ...disconnected(),
        attemptId,
        state: 'connecting',
        observedAt: new Date().toISOString(),
      };
      await this.devices.manager.transaction(async (manager) => {
        if (this.features?.isEnabled('feature.resource-quota')) {
          await assertOpenDeviceSlot(
            manager,
            device.ownerUserId,
            maxOpenDevices,
          );
        }
        const admitted = await manager
          .getRepository(ExternalAndroidDevice)
          .update(
            { id, attemptId: IsNull() },
            {
              attemptId,
              connection,
              lastActivityAt: null,
              maxSessionSeconds: maxSessionSeconds ?? null,
            },
          );
        if (admitted.affected !== 1)
          throw new ConflictException('Device connection changed.');
      });
      Object.assign(device, { attemptId, connection });
      const measure = this.metrics?.beginExternalAttachmentOperation(
        device.transport,
        'connect',
      );
      try {
        const observation = await this.broker.connect(id, attemptId, {
          transport: device.transport,
          selector: device.selector,
        });
        const recorded = await this.record(device, observation);
        measure?.(recorded.connection.failure ?? recorded.connection.state);
        return recorded;
      } catch {
        measure?.('broker_unavailable');
        return this.invalidate(device);
      }
    });
  }

  async recordAttachmentActivity(id: string, attachmentId: string) {
    await this.devices
      .createQueryBuilder()
      .update()
      .set({ lastActivityAt: new Date() })
      .where(
        "id = :id AND json_extract(connection, '$.attachmentId') = :attachmentId",
        { id, attachmentId },
      )
      .execute();
  }

  refresh(id: string, actor: ExternalDeviceActor) {
    return this.exclusive(id, async () => {
      if (!actor.canEnroll) this.requireUse(actor);
      const device = await this.getForConnection(id, actor);
      return this.isEnabled() ? this.observe(device) : device;
    });
  }

  async instructions(
    id: string,
    attemptId: string,
    actor: ExternalDeviceActor,
  ) {
    this.requireEnrollment(actor);
    this.assertEnabled();
    const device = await this.getForConnection(id, actor);
    this.requireAttempt(device, attemptId);
    return this.broker.instructions(id, attemptId);
  }

  verify(
    id: string,
    attemptId: string,
    proof: ExternalDeviceVerificationProof,
    actor: ExternalDeviceActor,
  ) {
    this.requireEnrollment(actor);
    return this.exclusive(id, async () => {
      this.assertEnabled();
      const device = await this.getForConnection(id, actor);
      this.requireAttempt(device, attemptId);
      const measure = this.metrics?.beginExternalAttachmentOperation(
        device.transport,
        'verify',
      );
      try {
        const recorded = await this.record(
          device,
          await this.broker.verify(id, attemptId, proof),
        );
        measure?.(recorded.connection.failure ?? recorded.connection.state);
        return recorded;
      } catch (error) {
        measure?.('error');
        throw error;
      }
    });
  }

  disconnect(id: string, actor: ExternalDeviceActor) {
    return this.exclusive(id, async () => {
      const device = await this.get(id, actor);
      if (device.attemptId) await this.detach(device);
      const connection = {
        ...disconnected(),
        observedAt: new Date().toISOString(),
      };
      await this.devices.update({ id, attemptId: IsNull() }, { connection });
      return Object.assign(device, { connection });
    });
  }

  private async getForConnection(id: string, actor: ExternalDeviceActor) {
    const device = await this.get(id, actor);
    if (device.transport === 'usb' && device.ownerUserId !== actor.userId)
      throw new NotFoundException('External device not found.');
    return device;
  }

  private requireUsbAdministrator(actor: ExternalDeviceActor) {
    if (!actor.administrator)
      throw new ForbiddenException(
        'Only administrators can enroll USB devices.',
      );
  }

  forget(id: string, actor: ExternalDeviceActor) {
    return this.exclusive(id, async () => {
      const device = await this.get(id, actor);
      if (device.attemptId) await this.detach(device);
      await this.devices.delete({ id, attemptId: IsNull() });
      return { id };
    });
  }

  private activeDevices() {
    return this.devices.find({ where: { attemptId: Not(IsNull()) } });
  }

  private async observe(device: ExternalAndroidDevice) {
    if (!device.attemptId || device.connection.state === 'offline')
      return device;
    try {
      return await this.record(
        device,
        await this.broker.inspect(device.id, device.attemptId),
      );
    } catch {
      return this.invalidate(device);
    }
  }

  private async record(
    device: ExternalAndroidDevice,
    connection: ExternalDeviceConnection,
  ) {
    const attemptId = device.attemptId;
    if (
      !attemptId ||
      connection.attemptId !== attemptId ||
      (connection.state === 'ready') !== Boolean(connection.attachmentId)
    ) {
      throw new ConflictException('Device connection changed.');
    }
    if (connection.state === 'offline') {
      return this.invalidate(
        device,
        connection.failure ?? 'transport_unavailable',
      );
    }
    const changed = await this.devices.update(
      { id: device.id, attemptId },
      {
        connection,
        ...(connection.state === 'ready' &&
          device.connection.state !== 'ready' && {
            lastActivityAt: new Date(),
          }),
      },
    );
    if (changed.affected !== 1)
      throw new ConflictException('Device connection changed.');
    return Object.assign(device, { connection });
  }

  private async invalidate(
    device: ExternalAndroidDevice,
    failure: ExternalDeviceConnection['failure'] = 'broker_unavailable',
  ) {
    if (!device.attemptId) return device;
    const connection: ExternalDeviceConnection = {
      ...disconnected(),
      state: 'offline',
      failure,
      observedAt: new Date().toISOString(),
    };
    await this.devices.update(
      { id: device.id, attemptId: device.attemptId },
      { connection },
    );
    Object.assign(device, { connection });
    try {
      await this.detach(device);
    } catch {
      // Keep the attempt for the next reconciliation when the broker returns.
    }
    return device;
  }

  private async detach(device: ExternalAndroidDevice) {
    const attemptId = device.attemptId;
    if (!attemptId) return;
    const connection: ExternalDeviceConnection = {
      ...disconnected(),
      state: 'offline',
      failure: device.connection.failure ?? 'verification_required',
      observedAt: new Date().toISOString(),
    };
    await this.devices.update({ id: device.id, attemptId }, { connection });
    Object.assign(device, { connection });
    const measure = this.metrics?.beginExternalAttachmentOperation(
      device.transport,
      'detach',
    );
    try {
      await this.broker.detach(device.id, attemptId);
      await this.devices.update(
        { id: device.id, attemptId },
        { attemptId: null },
      );
      measure?.('disconnected');
    } catch (error) {
      measure?.('error');
      throw error;
    }
    device.attemptId = null;
  }

  private requireAttempt(device: ExternalAndroidDevice, attemptId: string) {
    if (
      device.attemptId !== attemptId ||
      device.connection.attemptId !== attemptId
    ) {
      throw new ConflictException('Device connection changed.');
    }
  }

  private requireEnrollment(actor: ExternalDeviceActor) {
    if (!actor.administrator && !actor.canEnroll)
      throw new ForbiddenException(
        'External device enrollment permission is required.',
      );
  }

  private requireUse(actor: ExternalDeviceActor) {
    if (!actor.administrator && !actor.canUse)
      throw new ForbiddenException(
        'External device use permission is required.',
      );
  }

  private async exclusive<T>(id: string, operation: () => Promise<T>) {
    if (this.inflight.has(id))
      throw new ConflictException(
        'A device connection operation is already in progress.',
      );
    this.inflight.add(id);
    try {
      return await operation();
    } finally {
      this.inflight.delete(id);
    }
  }
}
