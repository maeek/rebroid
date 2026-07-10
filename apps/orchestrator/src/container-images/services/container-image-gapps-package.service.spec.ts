import type { ConfigService } from '@nestjs/config';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ApkPackageInspectionPort } from '../../apk/contracts/apk-package-inspection.port';
import { ContainerImageGappsPackageService } from './container-image-gapps-package.service';

describe('ContainerImageGappsPackageService', () => {
  it('requires Play Services, Play Store, and privileged permissions', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'rebroid-gapps-payload-'));
    try {
      const appDirectory = join(directory, 'system', 'product', 'priv-app');
      const permissionDirectory = join(
        directory,
        'system',
        'etc',
        'permissions',
      );
      await mkdir(appDirectory, { recursive: true });
      await mkdir(permissionDirectory, { recursive: true });
      await writeFile(join(appDirectory, 'GmsCore.apk'), 'gms');
      await writeFile(join(appDirectory, 'Phonesky.apk'), 'store');
      await writeFile(
        join(permissionDirectory, 'privapp-permissions-google.xml'),
        '<permissions package="com.google.android.gms" />',
      );
      const inspection = {
        extractPackageNameFromFile: jest.fn(async (path: string) =>
          path.endsWith('GmsCore.apk')
            ? 'com.google.android.gms'
            : 'com.android.vending',
        ),
      } satisfies ApkPackageInspectionPort;
      const service = new ContainerImageGappsPackageService(
        {} as ConfigService,
        inspection,
      );

      await expect(service.validate(directory)).resolves.toMatchObject({
        packageNames: ['com.google.android.gms', 'com.android.vending'],
        privilegedPermissionXml: 'privapp-permissions-google.xml',
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('rejects a payload missing required Google packages', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'rebroid-gapps-payload-'));
    try {
      await mkdir(join(directory, 'system'), { recursive: true });
      const inspection = {
        extractPackageNameFromFile: jest.fn().mockResolvedValue(null),
      } as unknown as ApkPackageInspectionPort;
      const service = new ContainerImageGappsPackageService(
        {} as ConfigService,
        inspection,
      );

      await expect(service.validate(directory)).rejects.toThrow(
        /com.google.android.gms/,
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
