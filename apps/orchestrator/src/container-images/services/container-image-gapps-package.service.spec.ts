import type { ConfigService } from '@nestjs/config';
import {
  mkdtemp,
  mkdir,
  rm,
  writeFile,
  readFile,
  readdir,
  readlink,
  stat,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { Readable } from 'node:stream';
import yauzl from 'yauzl';
import { basename, join } from 'node:path';
import type { ApkPackageInspectionPort } from '../../apk/contracts/apk-package-inspection.port';
import { ContainerImageGappsPackageService } from './container-image-gapps-package.service';

// ZIP containing a regular system file, its relative symlink, and an unrelated file.
const packageFixture = Buffer.from(
  'UEsDBBQAAAAIAAAAIQDFoEXlCgAAAAgAAAAaAAAAdmVuZG9yL3N5c3RlbS9ldGMvaW5mby50eHQrTi0pycxLLwYAUEsDBBQAAAAI' +
    'AAAAIQDAAVsXCgAAAAgAAAAXAAAAdmVuZG9yL3N5c3RlbS9ldGMvYWxpYXPLzEvL1yupKAEAUEsDBBQAAAAIAAAAIQBOQdTWCQAA' +
    'AAcAAAALAAAAaWdub3JlZC50eHTLTM/LL0pNAQBQSwECFAMUAAAACAAAACEAxaBF5QoAAAAIAAAAGgAAAAAAAAAAAAAAoIEAAAAA' +
    'dmVuZG9yL3N5c3RlbS9ldGMvaW5mby50eHRQSwECFAMUAAAACAAAACEAwAFbFwoAAAAIAAAAFwAAAAAAAAAAAAAA/6FCAAAAdmVu' +
    'ZG9yL3N5c3RlbS9ldGMvYWxpYXNQSwECFAMUAAAACAAAACEATkHU1gkAAAAHAAAACwAAAAAAAAAAAAAApIGBAAAAaWdub3JlZC50' +
    'eHRQSwUGAAAAAAMAAwDGAAAAswAAAAAA',
  'base64',
);

describe('ContainerImageGappsPackageService', () => {
  it('extracts only the system tree, preserves modes, and cleans failed staging', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'rebroid-gapps-extract-'));
    const service = new ContainerImageGappsPackageService(
      { getOrThrow: () => directory } as unknown as ConfigService,
      { extractPackageNameFromFile: jest.fn() },
    );
    const path = join(directory, 'package.zip');
    try {
      await writeFile(path, packageFixture);
      const work = await service.extract(path, 'ready');
      expect(await readdir(work)).toEqual(['system']);
      const file = join(work, 'system', 'etc', 'info.txt');
      expect(await readFile(file, 'utf8')).toBe('settings');
      expect((await stat(file)).mode & 0o777).toBe(0o640);
      expect(await readlink(join(work, 'system', 'etc', 'alias'))).toBe(
        'info.txt',
      );
      await expect(
        service.extract(join(directory, 'missing.zip'), 'failed'),
      ).rejects.toMatchObject({ code: 'ENOENT' });
      expect(await readdir(join(directory, 'image-build-gapps-work'))).toEqual([
        'ready',
      ]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('stops writing a cancelled package and releases its partial work tree', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'rebroid-gapps-cancel-'));
    const service = new ContainerImageGappsPackageService(
      { getOrThrow: () => directory } as unknown as ConfigService,
      { extractPackageNameFromFile: jest.fn() },
    );
    const controller = new AbortController();
    const open = jest
      .spyOn(yauzl.ZipFile.prototype, 'openReadStreamPromise')
      .mockImplementationOnce(async () => {
        controller.abort();
        return Readable.from(['settings']);
      });
    try {
      const path = join(directory, 'package.zip');
      await writeFile(path, packageFixture);
      await expect(
        service.extract(path, 'cancelled', controller.signal),
      ).rejects.toMatchObject({ name: 'AbortError' });
      expect(await readdir(join(directory, 'image-build-gapps-work'))).toEqual(
        [],
      );
    } finally {
      open.mockRestore();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('requires Play Services, Play Store, Google Services Framework, and privileged permissions', async () => {
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
      const packageByFile: Record<string, string> = {
        'GmsCore.apk': 'com.google.android.gms',
        'Phonesky.apk': 'com.android.vending',
        'GoogleServicesFramework.apk': 'com.google.android.gsf',
      };
      const inspection = {
        extractPackageNameFromFile: jest.fn(
          async (path: string) => packageByFile[basename(path)] ?? null,
        ),
      } satisfies ApkPackageInspectionPort;
      const service = new ContainerImageGappsPackageService(
        {} as ConfigService,
        inspection,
      );

      await expect(service.validate(directory)).rejects.toThrow(
        /missing com\.google\.android\.gsf/,
      );
      await writeFile(join(appDirectory, 'GoogleServicesFramework.apk'), 'gsf');
      await expect(service.validate(directory)).resolves.toMatchObject({
        packageNames: [
          'com.google.android.gms',
          'com.android.vending',
          'com.google.android.gsf',
        ],
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
