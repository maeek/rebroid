import { ConflictException } from '@nestjs/common';
import {
  chmod,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { ApplicationProfileMode } from '../../contracts/application-profile-mode';
import { RuntimeDownloadVolumeService } from './runtime-download-volume.service';
import { RuntimeFilePathService } from './runtime-file-path.service';
import { RuntimeUploadStreamService } from './runtime-upload-stream.service';

describe('RuntimeDownloadVolumeService', () => {
  let tempDir: string;
  let service: RuntimeDownloadVolumeService;
  let resources: {
    createVolume: jest.Mock;
    inspectVolume: jest.Mock;
  };
  const paths = new RuntimeFilePathService();
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
    const networkIsolation = {
      namesFor: jest.fn().mockReturnValue({ volumeName: 'volume-app-1' }),
    };
    service = new RuntimeDownloadVolumeService(
      networkIsolation as never,
      resources as never,
      paths,
      new RuntimeUploadStreamService(),
    );
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('lists files in the persistent download directory', async () => {
    const directory = join(tempDir, 'media', '0', 'Download');
    await service.storeStream(app, Readable.from(['z']), 'zeta.txt', {});
    await service.storeStream(app, Readable.from(['alpha']), 'alpha.txt', {});
    await mkdir(join(directory, 'nested-directory'));

    const files = await service.listFiles(app, {});

    expect(files.map((file) => file.name)).toEqual(['alpha.txt', 'zeta.txt']);
    expect(files[0]).toMatchObject({
      path: '/data/media/0/Download/alpha.txt',
      type: 'file',
      sizeBytes: 5,
      itemCount: null,
    });
  });

  it('creates the volume before writing uploads', async () => {
    await service.storeStream(app, Readable.from(['body']), 'upload.txt', {});

    await expect(
      readFile(join(tempDir, 'media', '0', 'Download', 'upload.txt'), 'utf8'),
    ).resolves.toBe('body');
    expect(resources.createVolume).toHaveBeenCalledWith(
      'app-1',
      'volume-app-1',
    );
  });

  it('stores streams and reports byte counts', async () => {
    const result = await service.storeStream(
      app,
      Readable.from(['hello', ' ', 'world']),
      'stream.txt',
      {},
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
    await service.storeStream(app, Readable.from(['original']), 'file.txt', {});
    const incomplete = Readable.from(
      (async function* () {
        yield Buffer.from('partial');
        throw new Error('upload interrupted');
      })(),
    );

    await expect(
      service.storeStream(app, incomplete, 'file.txt', {}),
    ).rejects.toThrow('upload interrupted');

    await expect(service.readFile(app, 'file.txt', {})).resolves.toEqual(
      Buffer.from('original'),
    );
    await expect(
      readdir(join(tempDir, 'media', '0', 'Download')),
    ).resolves.toEqual(['file.txt']);
  });

  it('retains file permissions when replacing an existing download', async () => {
    await service.storeStream(app, Readable.from(['original']), 'file.txt', {});
    const path = join(tempDir, 'media', '0', 'Download', 'file.txt');
    await chmod(path, 0o640);
    const { uid, gid } = await stat(path);

    await service.storeStream(app, Readable.from(['new']), 'file.txt', {});

    const replaced = await stat(path);
    expect(replaced).toMatchObject({ uid, gid });
    expect(replaced.mode & 0o777).toBe(0o640);
    await expect(readFile(path, 'utf8')).resolves.toBe('new');
  });

  it('reads persistent download files', async () => {
    await service.storeStream(app, Readable.from(['content']), 'read.txt', {});

    await expect(service.readFile(app, 'read.txt', {})).resolves.toEqual(
      Buffer.from('content'),
    );
  });

  it('rejects writes for non-persistent profile queries', async () => {
    await expect(
      service.storeStream(app, Readable.from(['body']), 'upload.txt', {
        profileMode: ApplicationProfileMode.Temporary,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
