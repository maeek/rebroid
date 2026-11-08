import { AndroidAppsConfigurationService } from './android-apps-configuration.service';

describe('APK owner authorization', () => {
  const service = Object.create(
    AndroidAppsConfigurationService.prototype,
  ) as AndroidAppsConfigurationService;
  it('rejects foreign uploads before modifying an application', async () => {
    const applyUploadedApk = jest.fn();
    Object.assign(service, {
      reconciler: {
        reconcileById: jest
          .fn()
          .mockResolvedValue({ ownerUserId: 'owner', status: 'stopped' }),
      },
      apks: { get: jest.fn().mockResolvedValue({ ownerUserId: 'other' }) },
      applicationFactory: { applyUploadedApk },
    });
    await expect(
      service.updateApk('app', { uploadedApkId: 'upload' }),
    ).rejects.toThrow('owner');
    expect(applyUploadedApk).not.toHaveBeenCalled();
  });
});
