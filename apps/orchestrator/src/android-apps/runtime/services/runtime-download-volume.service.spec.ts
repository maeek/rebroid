import { ConflictException } from '@nestjs/common';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Transform } from 'node:stream';
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
    const uploads = {
      createByteCounter: (onBytes: (bytes: number) => void) =>
        new Transform({
          transform(chunk, _encoding, callback) {
            onBytes(Buffer.byteLength(chunk));
            callback(null, chunk);
          },
        }),
    } as RuntimeUploadStreamService;

    service = new RuntimeDownloadVolumeService(
      networkIsolation as never,
      resources as never,
      paths,
      uploads,
    );
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('lists files in the persistent download directory', async () => {
    const directory = join(tempDir, 'media', '0', 'Download');
    await service.storeBuffer(app, 'zeta.txt', Buffer.from('z'), {});
    await service.storeBuffer(app, 'alpha.txt', Buffer.from('alpha'), {});
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

  it('creates the volume before writing buffers', async () => {
    await service.storeBuffer(app, 'upload.txt', Buffer.from('body'), {});

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

  it('reads persistent download files', async () => {
    await service.storeBuffer(app, 'read.txt', Buffer.from('content'), {});

    await expect(service.readFile(app, 'read.txt', {})).resolves.toEqual(
      Buffer.from('content'),
    );
  });

  it('rejects writes for non-persistent profile queries', async () => {
    await expect(
      service.storeBuffer(app, 'upload.txt', Buffer.from('body'), {
        profileMode: ApplicationProfileMode.Temporary,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
