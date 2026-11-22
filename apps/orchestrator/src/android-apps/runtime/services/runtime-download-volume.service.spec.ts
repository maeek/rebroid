import { ProfileVolumeAccess } from '../../common/services/profile-volume-access.service';
import { ConflictException } from '@nestjs/common';
import {
  chmod,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { ApplicationProfileMode } from '../../contracts/application-profile-mode';
import { RuntimeDownloadVolumeService } from './runtime-download-volume.service';
import { RuntimeUploadStreamService } from './runtime-upload-stream.service';

describe('RuntimeDownloadVolumeService', () => {
  let tempDir: string;
  let service: RuntimeDownloadVolumeService;
  let volumeAccess: ProfileVolumeAccess;
  let resources: {
    createVolume: jest.Mock;
    inspectVolume: jest.Mock;
  };
  const app = {
    id: 'app-1',
    name: 'Demo App',
    profileMode: ApplicationProfileMode.Persistent,
    profileName: 'default',
  } as never;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'rebroid-download-volume-test-'));
    resources = {
      createVolume: jest.fn(),
      inspectVolume: jest.fn().mockResolvedValue({ Mountpoint: tempDir }),
    };
    volumeAccess = new ProfileVolumeAccess();
    service = new RuntimeDownloadVolumeService(
      { resourcePrefix: 'rebroid' } as never,
      resources as never,
      new RuntimeUploadStreamService({} as never),
      volumeAccess,
    );
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('lists files in the persistent download directory', async () => {
    const directory = join(tempDir, 'media', '0', 'Download');
    await service.storeStream(app, Readable.from(['z']), 'zeta.txt', 'default');
    await service.storeStream(
      app,
      Readable.from(['alpha']),
      'alpha.txt',
      'default',
    );
    await mkdir(join(directory, 'nested-directory'));
    await writeFile(join(directory, ' alpha.txt '), 'different file');
    await writeFile(join(directory, ' '), 'blank name');
    await symlink('alpha.txt', join(directory, 'linked.txt'));

    const files = await service.listFiles(app, 'default');

    expect(files.map((file) => file.name)).toEqual(['alpha.txt', 'zeta.txt']);
    expect(files[0]).toMatchObject({
      path: '/data/media/0/Download/alpha.txt',
      type: 'file',
      sizeBytes: 5,
      itemCount: null,
    });
  });

  it('creates the volume before writing uploads', async () => {
    await service.storeStream(
      app,
      Readable.from(['body']),
      'upload.txt',
      'default',
    );

    await expect(
      readFile(join(tempDir, 'media', '0', 'Download', 'upload.txt'), 'utf8'),
    ).resolves.toBe('body');
    expect(resources.createVolume).toHaveBeenCalledWith(
      'app-1',
      'rebroid-data-demo-app-default-app-1',
    );
  });

  it('protects the physical volume until all concurrent uploads to its aliases finish', async () => {
    const volume = 'rebroid-data-demo-app-work-app-1';
    let finishSecond!: () => void;
    resources.createVolume.mockResolvedValueOnce(undefined).mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishSecond = resolve;
      }),
    );
    const first = service.storeStream(
      app,
      Readable.from(['one']),
      'one.txt',
      'Work',
    );
    const second = service.storeStream(
      app,
      Readable.from(['two']),
      'two.txt',
      'work',
    );
    try {
      await first;
      const remove = jest.fn().mockResolvedValue(undefined);
      await expect(volumeAccess.withRemoval(volume, remove)).rejects.toThrow(
        ConflictException,
      );
      await volumeAccess.withRemoval(
        'rebroid-data-demo-app-personal-app-1',
        remove,
      );
      expect(remove).toHaveBeenCalledTimes(1);
    } finally {
      finishSecond();
      await second;
    }
    await volumeAccess.withRemoval(volume, async () => {
      await expect(
        service.storeStream(app, Readable.from(['three']), 'three.txt', 'WORK'),
      ).rejects.toMatchObject({ status: 409 });
    });
    expect(resources.createVolume).toHaveBeenCalledTimes(2);
  });

  it('rejects an inaccessible volume instead of creating its reported mountpoint', async () => {
    const mountpoint = join(tempDir, 'engine-only-volume');
    resources.inspectVolume.mockResolvedValue({ Mountpoint: mountpoint });
    await expect(
      service.storeStream(app, Readable.from(['body']), 'file.txt', 'default'),
    ).rejects.toThrow('Persistent profile storage is unavailable');
    await expect(stat(mountpoint)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('stores streams and reports byte counts', async () => {
    const result = await service.storeStream(
      app,
      Readable.from(['hello', ' ', 'world']),
      'stream.txt',
      'default',
    );

    expect(result).toMatchObject({
      uploaded: true,
      name: 'stream.txt',
      path: '/data/media/0/Download/stream.txt',
      type: 'file',
      sizeBytes: 11,
      itemCount: null,
    });
    await expect(
      readFile(join(tempDir, 'media', '0', 'Download', 'stream.txt'), 'utf8'),
    ).resolves.toBe('hello world');
  });

  it('keeps the previous download when its replacement stream fails', async () => {
    await service.storeStream(
      app,
      Readable.from(['original']),
      'file.txt',
      'default',
    );
    const incomplete = Readable.from(
      (async function* () {
        yield Buffer.from('partial');
        throw new Error('upload interrupted');
      })(),
    );

    await expect(
      service.storeStream(app, incomplete, 'file.txt', 'default'),
    ).rejects.toThrow('upload interrupted');

    await expect(service.readFile(app, 'file.txt', 'default')).resolves.toEqual(
      Buffer.from('original'),
    );
    await expect(
      readdir(join(tempDir, 'media', '0', 'Download')),
    ).resolves.toEqual(['file.txt']);
  });

  it('retains file permissions when replacing an existing download', async () => {
    await service.storeStream(
      app,
      Readable.from(['original']),
      'file.txt',
      'default',
    );
    const path = join(tempDir, 'media', '0', 'Download', 'file.txt');
    await chmod(path, 0o640);
    const { uid, gid } = await stat(path);

    await service.storeStream(
      app,
      Readable.from(['new']),
      'file.txt',
      'default',
    );

    const replaced = await stat(path);
    expect(replaced).toMatchObject({ uid, gid });
    expect(replaced.mode & 0o777).toBe(0o640);
    await expect(readFile(path, 'utf8')).resolves.toBe('new');
  });

  it('reads persistent download files', async () => {
    await service.storeStream(
      app,
      Readable.from(['content']),
      'read.txt',
      'default',
    );

    await expect(service.readFile(app, 'read.txt', 'default')).resolves.toEqual(
      Buffer.from('content'),
    );
  });

  it('distinguishes missing persistent downloads from an offline temporary profile', async () => {
    const read = () => service.readFile(app, 'missing.txt', 'default');
    await expect(service.listFiles(app, 'default')).resolves.toEqual([]);
    await expect(read()).rejects.toMatchObject({ status: 404 });
    await mkdir(join(tempDir, 'media', '0', 'Download'), { recursive: true });
    await expect(read()).rejects.toMatchObject({ status: 404 });
    resources.inspectVolume.mockResolvedValue(null);
    await expect(read()).rejects.toMatchObject({ status: 404 });
    await expect(
      service.readFile(app, 'missing.txt', null),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('reports an unusable profile directory for both listings and reads', async () => {
    await writeFile(join(tempDir, 'media'), 'not a directory');
    await expect(service.listFiles(app, 'default')).rejects.toMatchObject({
      status: 503,
    });
    await expect(
      service.readFile(app, 'notes.txt', 'default'),
    ).rejects.toMatchObject({ status: 503 });
  });

  it('rejects writes for non-persistent profile queries', async () => {
    await expect(
      service.storeStream(app, Readable.from(['body']), 'upload.txt', null),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
