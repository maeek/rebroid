import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { AndroidApplication } from '../../android-application.entity';
import { AndroidAppsLifecycleTransitionService } from '../../common/services/android-apps-lifecycle-transition.service';
import {
  AndroidApplicationLifecycleStage,
  AndroidApplicationStatus,
} from '../../contracts/android-application-status';
import {
  AndroidAppLifecycleJob,
  AndroidAppLifecycleJobKind,
} from '../../lifecycle/entities/android-app-lifecycle-job.entity';
import { SerializedSqliteDataSource } from '../../../database/serialized-sqlite-data-source';
import { InitializeSqliteSchema1800000008000 } from '../../../database/migrations/1800000008000-initialize-sqlite-schema';
import { ExternalAdbBrokerClient } from './external-adb-broker.client';
import { ExternalAndroidDevice } from './external-android-device.entity';
import { ExternalAndroidDevicesService } from './external-android-devices.service';

describe('external device enrollment', () => {
  const admin = { userId: 'admin', administrator: true };
  const owner = { userId: 'owner', administrator: false, canUse: true };
  const ownerEnroller = { ...owner, canEnroll: true };
  const outsider = { userId: 'outsider', administrator: false, canUse: true };
  const endpoint = '192.168.1.20:5555';
  const makeInput = () => ({
    name: 'Android VM',
    transport: 'tcp' as const,
    endpoint,
  });
  let db: DataSource;
  let service: ExternalAndroidDevicesService;
  const externalEnabled = jest.fn();
  const broker = {
    enabled: true,
    listCandidates: jest.fn(),
    resolveCandidate: jest.fn(),
    connect: jest.fn(),
    verify: jest.fn(),
    inspect: jest.fn(),
    detach: jest.fn(),
    checkReadiness: jest.fn(),
    checkTcpEndpoint: jest.fn(),
    synchronizeViewerFeatures: jest.fn(),
    listViewers: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    externalEnabled.mockReturnValue(true);
    broker.synchronizeViewerFeatures.mockResolvedValue({ revision: 1 });
    broker.listViewers.mockResolvedValue({ items: [] });
    db = await new SerializedSqliteDataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [
        ExternalAndroidDevice,
        AndroidApplication,
        AndroidAppLifecycleJob,
      ],
      migrations: [InitializeSqliteSchema1800000008000],
      migrationsRun: true,
    }).initialize();
    service = new ExternalAndroidDevicesService(
      db.getRepository(ExternalAndroidDevice),
      broker as unknown as ExternalAdbBrokerClient,
      new ConfigService({ app: { externalAdb: { tcpEndpoints: [endpoint] } } }),
      {
        isEnabled: (key: string) =>
          key === 'feature.resource-quota' || externalEnabled(),
        assertEnabled: jest.fn(),
      } as never,
    );
  });

  afterEach(async () => db.destroy());

  it('checks only approved endpoints for enrollers without registering an attachment', async () => {
    await expect(
      service.checkTcpEndpoint(endpoint, owner),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.checkTcpEndpoint('192.168.1.20:5556', ownerEnroller),
    ).resolves.toEqual({ status: 'not_allowed' });
    expect(broker.synchronizeViewerFeatures).not.toHaveBeenCalled();
    expect(broker.checkTcpEndpoint).not.toHaveBeenCalled();

    broker.checkTcpEndpoint.mockResolvedValueOnce({ status: 'reachable' });
    await expect(
      service.checkTcpEndpoint(endpoint, ownerEnroller),
    ).resolves.toEqual({ status: 'reachable' });
    expect(broker.checkTcpEndpoint).toHaveBeenCalledWith(
      endpoint,
      expect.any(AbortSignal),
    );
    expect(broker.connect).not.toHaveBeenCalled();
    await expect(service.list(ownerEnroller)).resolves.toEqual([]);
  });

  it('grants enrollment separately from use and keeps delegated enrollment owner-scoped', async () => {
    const enroller = {
      userId: owner.userId,
      administrator: false,
      canEnroll: true,
    };
    await expect(service.register(makeInput(), owner)).rejects.toMatchObject({
      status: 403,
    });
    const device = await service.register(makeInput(), enroller);
    expect(device.ownerUserId).toBe(enroller.userId);
    await expect(service.connect(device.id, enroller)).rejects.toMatchObject({
      status: 403,
    });
    expect(broker.connect).not.toHaveBeenCalled();
  });

  it('restricts USB discovery, enrollment and attachment to the owning administrator', async () => {
    const usb = {
      name: 'Phone',
      transport: 'usb' as const,
      candidateId: randomUUID(),
    };
    await expect(service.candidates(ownerEnroller)).rejects.toMatchObject({
      status: 403,
    });
    await expect(service.register(usb, ownerEnroller)).rejects.toMatchObject({
      status: 403,
    });
    expect(broker.resolveCandidate).not.toHaveBeenCalled();
    broker.resolveCandidate.mockResolvedValue({
      selector: 'test-usb-selector',
    });
    const device = await service.register(usb, admin);
    expect(device.ownerUserId).toBe(admin.userId);
    const otherAdmin = { administrator: true, userId: 'other-admin' };
    await expect(service.list(otherAdmin)).resolves.toEqual([]);
    await expect(service.connect(device.id, otherAdmin)).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      service.get(device.id, { ...admin, administrator: false }),
    ).rejects.toMatchObject({ status: 404 });
    expect(broker.connect).not.toHaveBeenCalled();
  });

  it('distinguishes feature intent from authenticated broker readiness', async () => {
    externalEnabled.mockReturnValue(false);
    await expect(service.availability()).resolves.toEqual({
      enabled: false,
      status: 'feature_disabled',
    });
    expect(broker.synchronizeViewerFeatures).not.toHaveBeenCalled();
    expect(broker.checkReadiness).not.toHaveBeenCalled();

    externalEnabled.mockReturnValue(true);
    broker.synchronizeViewerFeatures.mockRejectedValueOnce(
      new Error('unreachable'),
    );
    await expect(service.availability()).resolves.toEqual({
      enabled: false,
      status: 'broker_unavailable',
    });
    broker.checkReadiness.mockRejectedValueOnce(new Error('keys unavailable'));
    await expect(service.availability()).resolves.toEqual({
      enabled: false,
      status: 'broker_unavailable',
    });
    await expect(service.availability()).resolves.toEqual({
      enabled: true,
      status: 'available',
    });
    expect(broker.connect).not.toHaveBeenCalled();
  });

  it('blocks new connections and retires attempts when the feature is disabled', async () => {
    const device = await service.register(makeInput(), ownerEnroller);
    broker.connect.mockImplementation(
      async (_id: string, attemptId: string) => ({
        state: 'awaiting_verification',
        attemptId,
        attachmentId: null,
        failure: null,
        observedAt: null,
      }),
    );
    broker.detach.mockResolvedValue({ detached: true });
    const connected = await service.connect(device.id, owner);
    externalEnabled.mockReturnValue(false);

    await expect(service.connect(device.id, owner)).rejects.toThrow(
      'External ADB is disabled',
    );
    await service.synchronize();
    expect(broker.detach).toHaveBeenCalledWith(device.id, connected.attemptId);
    await expect(service.get(device.id, owner)).resolves.toMatchObject({
      attemptId: null,
      connection: { state: 'offline', attachmentId: null },
    });
  });

  it('detaches a verified attachment that exceeded the trusted inactivity limit', async () => {
    const device = await service.register(makeInput(), ownerEnroller);
    broker.connect.mockImplementation(
      async (_id: string, attemptId: string) => ({
        state: 'awaiting_verification',
        attemptId,
        attachmentId: null,
        failure: null,
        observedAt: null,
      }),
    );
    const connected = await service.connect(device.id, owner, 1, 10);
    broker.verify.mockResolvedValue({
      ...connected.connection,
      state: 'ready',
      attachmentId: randomUUID(),
    });
    broker.detach.mockResolvedValue({ detached: true });
    await service.verify(device.id, connected.attemptId!, 'challenge', admin);
    await db
      .getRepository(ExternalAndroidDevice)
      .update(device.id, { lastActivityAt: new Date(Date.now() - 11_000) });

    await service.synchronize();

    expect(broker.detach).toHaveBeenCalledWith(device.id, connected.attemptId);
    await expect(service.get(device.id, owner)).resolves.toMatchObject({
      attemptId: null,
      connection: {
        state: 'offline',
        failure: 'attempt_expired',
        attachmentId: null,
      },
    });
  });

  it('admits only one concurrent managed Start or external Connect for the last slot', async () => {
    const device = await service.register(makeInput(), ownerEnroller);
    const managed = await db.getRepository(AndroidApplication).save({
      name: 'Managed fixture',
      ownerUserId: owner.userId,
      containerImage: 'image',
      containerName: 'managed',
      networkName: 'managed',
      volumeName: 'managed',
      networkPolicyAllowCidrs: '[]',
      savedProfilesJson: '[]',
      status: AndroidApplicationStatus.Stopped,
      lifecycleStage: AndroidApplicationLifecycleStage.Stopped,
    });
    const transitions = new AndroidAppsLifecycleTransitionService(
      db,
      { appendLifecycle: jest.fn() } as never,
      { isEnabled: () => true } as never,
      {} as never,
    );
    broker.connect.mockImplementation(
      async (_id: string, attemptId: string) => ({
        state: 'awaiting_verification',
        attemptId,
        attachmentId: null,
        failure: null,
        observedAt: null,
      }),
    );

    const results = await Promise.allSettled([
      service.connect(device.id, owner, 1),
      transitions.beginJob(
        managed.id,
        AndroidAppLifecycleJobKind.Start,
        {
          status: AndroidApplicationStatus.Provisioning,
        },
        undefined,
        false,
        1,
      ),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.find((result) => result.status === 'rejected'),
    ).toMatchObject({
      reason: { response: { code: 'open_app_quota_exceeded' } },
    });
    expect(broker.connect).toHaveBeenCalledTimes(
      results[0].status === 'fulfilled' ? 1 : 0,
    );
  });

  it('allows only one owner to claim the endpoint and hides it from other owners', async () => {
    await expect(service.register(makeInput(), owner)).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      service.register({ ...makeInput(), endpoint: '127.0.0.1:5555' }, admin),
    ).rejects.toMatchObject({ status: 400 });
    const results = await Promise.allSettled([
      service.register(makeInput(), ownerEnroller),
      service.register(makeInput(), { ...outsider, canEnroll: true }),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    expect(await service.list(admin)).toHaveLength(1);
    expect(
      (await service.list(owner)).length +
        (await service.list(outsider)).length,
    ).toBe(1);
  });

  it('binds verification to the current attempt and forgets only after detach', async () => {
    const device = await service.register(makeInput(), ownerEnroller);
    await expect(service.connect(device.id, outsider)).rejects.toMatchObject({
      status: 404,
    });
    broker.connect.mockImplementation(
      async (_id: string, attemptId: string) => ({
        state: 'awaiting_verification',
        attemptId,
        attachmentId: null,
        failure: null,
        observedAt: null,
      }),
    );
    const waiting = await service.connect(device.id, owner);
    const attempt = waiting.connection.attemptId!;
    expect(() =>
      service.verify(device.id, attempt, 'challenge', owner),
    ).toThrow('External device enrollment permission is required');
    await expect(
      service.verify(device.id, randomUUID(), 'challenge', admin),
    ).rejects.toMatchObject({ status: 409 });
    const attachmentId = randomUUID();
    broker.verify.mockResolvedValue({
      ...waiting.connection,
      state: 'ready',
      attachmentId,
    });
    expect(
      (await service.verify(device.id, attempt, 'challenge', admin)).connection
        .state,
    ).toBe('ready');
    await db.transaction(async (transaction) => {
      await expect(
        service.readOwnedAttachmentId(transaction, device.id, owner.userId),
      ).resolves.toBe(attachmentId);
      await expect(
        service.readOwnedAttachmentId(transaction, device.id, outsider.userId),
      ).resolves.toBeNull();
    });
    broker.detach.mockRejectedValueOnce(new Error('unreachable'));
    await expect(service.forget(device.id, owner)).rejects.toThrow(
      'unreachable',
    );
    expect(
      (await service.get(device.id, owner)).connection.attachmentId,
    ).toBeNull();
    broker.detach.mockResolvedValue({ detached: true });
    await service.forget(device.id, owner);
    expect(broker.detach).toHaveBeenLastCalledWith(device.id, attempt);
    await expect(service.get(device.id, owner)).rejects.toMatchObject({
      status: 404,
    });
  });
});
