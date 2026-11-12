import { DataSource, type Repository } from 'typeorm';
import { InitializeSqliteSchema1800000005000 } from '../../database/migrations/1800000005000-initialize-sqlite-schema';
import { AndroidApplication } from '../android-application.entity';
import {
  AndroidApplicationLifecycleStage,
  AndroidApplicationStatus,
} from '../contracts/android-application-status';
import { AndroidAppsQueryService } from '../common/services/android-apps-query.service';
import { AndroidAppsStatusService } from '../common/services/android-apps-status.service';
import { AndroidApplicationsRepository } from './android-applications.repository';

const createRepository = (overrides: Partial<Repository<AndroidApplication>>) =>
  new AndroidApplicationsRepository(
    overrides as Repository<AndroidApplication>,
  );

describe('AndroidApplicationsRepository capability ports', () => {
  it('returns only existing application ids', async () => {
    const find = jest.fn().mockResolvedValue([{ id: 'app-2' }]);
    const repository = createRepository({ find });

    await expect(
      repository.findExistingIds(['app-1', 'app-2']),
    ).resolves.toEqual(new Set(['app-2']));
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ select: { id: true } }),
    );
  });

  it('maps restricted runtime rows to the minimal network-policy target', async () => {
    const find = jest.fn().mockResolvedValue([
      {
        id: 'app-1',
        containerId: 'container-1',
        networkName: 'network-1',
        networkPolicyEnabled: true,
        networkPolicyAllowCidrs: '["10.0.0.0/8"]',
        networkPolicyRevision: 2,
        name: 'must not leak',
      },
    ]);
    const repository = createRepository({ find });

    await expect(
      repository.findRestrictedRuntimePolicyTargets(),
    ).resolves.toEqual([
      {
        id: 'app-1',
        containerId: 'container-1',
        networkName: 'network-1',
        networkPolicyEnabled: true,
        networkPolicyAllowCidrs: '["10.0.0.0/8"]',
        networkPolicyRevision: 2,
      },
    ]);
  });

  it('exposes APK reference counts and ids without leaking entities', async () => {
    const countBy = jest.fn().mockResolvedValue(2);
    const find = jest
      .fn()
      .mockResolvedValue([{ uploadedApkId: 'apk-1' }, { uploadedApkId: null }]);
    const repository = createRepository({ countBy, find });

    await expect(repository.countUsingUploadedApk('apk-1')).resolves.toBe(2);
    await expect(
      repository.findReferencedUploadedApkIds(['apk-1', 'apk-2']),
    ).resolves.toEqual(new Set(['apk-1']));
  });
});

describe('Android application runtime observations', () => {
  let database: DataSource;
  let apps: Repository<AndroidApplication>;
  let repository: AndroidApplicationsRepository;

  beforeEach(async () => {
    database = await new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [AndroidApplication],
      migrations: [InitializeSqliteSchema1800000005000],
      migrationsRun: true,
    }).initialize();
    apps = database.getRepository(AndroidApplication);
    repository = new AndroidApplicationsRepository(apps);
  });

  afterEach(async () => {
    if (database?.isInitialized) await database.destroy();
  });

  const makeApp = () =>
    apps.save(
      apps.create({
        name: 'Fixture',
        containerImage: 'fixture',
        containerName: 'runtime-fixture',
        containerId: 'container-1',
        networkName: 'runtime-fixture',
        volumeName: 'runtime-fixture',
        networkPolicyAllowCidrs: '[]',
        savedProfilesJson: '[]',
        status: AndroidApplicationStatus.Running,
        lastStartedAt: new Date('2026-01-01T00:00:00Z'),
      }),
    );

  it('hydrates only the owner’s running and recent candidates with summary fields', async () => {
    const [running, recent, otherOwner, stopped] = await apps.save(
      Array.from({ length: 100 }, (_, index) =>
        apps.create({
          name: `Fixture ${index}`,
          containerImage: 'fixture',
          containerName: `runtime-fixture-${index}`,
          networkName: `network-fixture-${index}`,
          volumeName: `volume-fixture-${index}`,
          ownerUserId: index === 2 ? 'other-owner' : 'owner',
          savedProfilesJson: '[{"name":"example"}]',
          status:
            index === 0 || index === 2
              ? AndroidApplicationStatus.Running
              : AndroidApplicationStatus.Stopped,
          lifecycleStage:
            index === 0 || index === 2
              ? AndroidApplicationLifecycleStage.Ready
              : AndroidApplicationLifecycleStage.Stopped,
        }),
      ),
    );
    const query = new AndroidAppsQueryService(
      repository,
      new AndroidAppsStatusService(),
    );
    const result = await query.listSummaries({
      ownerUserId: 'owner',
      applicationIds: [recent.id, otherOwner.id],
      includeRunning: 'true',
    });

    expect(result).toHaveLength(2);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: running.id,
          statusDetail: expect.objectContaining({ title: 'Ready' }),
        }),
        expect.objectContaining({
          id: recent.id,
          statusDetail: expect.objectContaining({ title: 'Stopped' }),
        }),
      ]),
    );
    expect(result.every((app) => app.savedProfilesJson === undefined)).toBe(
      true,
    );
    expect(
      (await query.listSummaries({ applicationIds: [stopped.id] })).map(
        (app) => app.id,
      ),
    ).toEqual([stopped.id]);
    expect(await query.listSummaries({})).toHaveLength(100);
  });

  it('includes restricted containers even when the app is marked Error', async () => {
    const app = await makeApp();
    await apps.update(app.id, { networkPolicyEnabled: false });
    expect(await repository.findRestrictedRuntimePolicyTargets()).toEqual([]);

    await apps.update(app.id, {
      status: AndroidApplicationStatus.Error,
      networkPolicyEnabled: true,
    });
    expect(await repository.findRestrictedRuntimePolicyTargets()).toEqual([
      {
        id: app.id,
        containerId: 'container-1',
        networkName: app.networkName,
        networkPolicyEnabled: true,
        networkPolicyAllowCidrs: '[]',
        networkPolicyRevision: 0,
      },
    ]);

    await apps.update(app.id, { containerId: null });
    expect(await repository.findRestrictedRuntimePolicyTargets()).toEqual([]);
  });

  it('increments the revision with policy settings and preserves it on unrelated saves', async () => {
    const stale = await makeApp();
    await repository.updateNetworkPolicyState(stale.id, {
      networkPolicyStatus: 'applied',
      networkPolicyMessage: 'Rules applied',
      networkPolicyAppliedAt: new Date('2026-01-01T00:00:03Z'),
    });
    await repository.updateNetworkPolicyConfiguration(stale.id, {
      networkPolicyEnabled: false,
      networkPolicyAllowCidrs: '["192.0.2.0/24"]',
    });
    await repository.save({ ...stale, name: 'Renamed' }, true);
    await repository.save(stale);
    await expect(apps.findOneByOrFail({ id: stale.id })).resolves.toMatchObject(
      {
        name: 'Renamed',
        networkPolicyEnabled: false,
        networkPolicyAllowCidrs: '["192.0.2.0/24"]',
        networkPolicyRevision: 1,
        networkPolicyStatus: null,
        networkPolicyMessage: null,
        networkPolicyAppliedAt: null,
      },
    );
  });

  it('updates activity without overwriting newer fields or reversing the timestamp', async () => {
    const app = await makeApp();
    const observedAt = new Date('2026-01-01T00:00:03Z');
    await apps.update(app.id, { networkPolicyEnabled: true });

    await expect(
      repository.updateViewerActivity(app, observedAt),
    ).resolves.toMatchObject({ affected: 1 });
    await expect(
      repository.updateViewerActivity(app, new Date(observedAt.getTime() - 1)),
    ).resolves.toMatchObject({ affected: 0 });
    await expect(apps.findOneByOrFail({ id: app.id })).resolves.toMatchObject({
      networkPolicyEnabled: true,
      lastScrcpyActivityAt: observedAt,
    });

    await apps.update(app.id, { status: AndroidApplicationStatus.Stopped });
    await expect(
      repository.updateViewerActivity(app, new Date(observedAt.getTime() + 1)),
    ).resolves.toMatchObject({ affected: 0 });
  });

  it('discards a viewer policy result for replaced policy settings or runtime', async () => {
    const app = await makeApp();
    const patch = {
      networkPolicyStatus: 'applied' as const,
      networkPolicyMessage: 'Applied',
      networkPolicyAppliedAt: new Date('2026-01-01T00:00:03Z'),
    };
    await expect(
      repository.updateViewerNetworkPolicyState(app, patch),
    ).resolves.toMatchObject({ affected: 1 });
    await apps.update(app.id, { networkPolicyAllowCidrs: '["192.0.2.0/24"]' });
    await expect(
      repository.updateViewerNetworkPolicyState(app, patch),
    ).resolves.toMatchObject({ affected: 0 });

    await apps.update(app.id, {
      networkPolicyAllowCidrs: '[]',
      containerId: 'container-2',
    });
    await expect(
      repository.updateViewerNetworkPolicyState(app, patch),
    ).resolves.toMatchObject({ affected: 0 });
    await expect(apps.findOneByOrFail({ id: app.id })).resolves.toMatchObject({
      containerId: 'container-2',
    });
  });
});
