import type { Repository } from 'typeorm';
import { AndroidApplication } from '../android-application.entity';
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

  it('maps running policy rows to the minimal network-policy target', async () => {
    const find = jest.fn().mockResolvedValue([
      {
        id: 'app-1',
        containerId: 'container-1',
        networkName: 'network-1',
        networkPolicyEnabled: true,
        networkPolicyAllowCidrs: '["10.0.0.0/8"]',
        name: 'must not leak',
      },
    ]);
    const repository = createRepository({ find });

    await expect(repository.findRunningNetworkPolicyTargets()).resolves.toEqual(
      [
        {
          id: 'app-1',
          containerId: 'container-1',
          networkName: 'network-1',
          networkPolicyEnabled: true,
          networkPolicyAllowCidrs: '["10.0.0.0/8"]',
        },
      ],
    );
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
