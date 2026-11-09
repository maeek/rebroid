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

describe('resolved application image authorization', () => {
  const service = Object.create(
    AndroidAppsConfigurationService.prototype,
  ) as AndroidAppsConfigurationService;
  const resolveKind = jest.fn();
  const cloneForOwner = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(service, {
      features: { assertEnabled: jest.fn() },
      settings: {
        getSettings: jest.fn().mockResolvedValue({
          defaultContainerImage: 'redroid/redroid:latest',
          dockerImageRegistry: 'registry.example.com',
        }),
      },
      redroidConfig: { privileged: true },
      reconciler: {
        reconcileById: jest.fn().mockResolvedValue({
          containerImage: 'redroid/redroid:latest',
          uploadedApkId: 'source-apk',
        }),
      },
      apks: { cloneForOwner },
      runtimeImages: { resolveKind },
    });
  });

  it.each([
    [undefined, 'redroid'],
    ['redroid/redroid:latest', 'redroid'],
    ['docker.io/redroid/redroid:latest', 'none'],
    ['registry.example.com/redroid/redroid:latest', 'all'],
    ['redroid/redroid-payload:latest', 'redroid'],
  ] as const)(
    'rejects create image %s for %s access',
    async (containerImage, access) => {
      await expect(
        service.create({ name: 'Test app', containerImage }, undefined, access),
      ).rejects.toMatchObject({ status: 403 });
      expect(resolveKind).not.toHaveBeenCalled();
    },
  );

  it('allows a registry-qualified official Redroid image', async () => {
    resolveKind.mockRejectedValueOnce(new Error('Inspection reached'));
    await expect(
      service.create(
        {
          name: 'Test app',
          containerImage: 'docker.io/redroid/redroid:latest',
        },
        undefined,
        'redroid',
      ),
    ).rejects.toThrow('Inspection reached');
    expect(resolveKind).toHaveBeenCalledWith(
      'docker.io/redroid/redroid:latest',
    );
  });

  it('rejects a clone before copying the source APK', async () => {
    await expect(
      service.clone('source', {}, undefined, 'redroid'),
    ).rejects.toMatchObject({ status: 403 });
    expect(cloneForOwner).not.toHaveBeenCalled();
    expect(resolveKind).not.toHaveBeenCalled();
  });
});
