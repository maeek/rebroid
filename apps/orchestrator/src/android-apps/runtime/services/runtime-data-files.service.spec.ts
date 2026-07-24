import {
  ConflictException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { Readable } from 'node:stream';
import sharp from 'sharp';
import { AndroidApplicationStatus } from '../../contracts/android-application-status';
import { ContainerCommandFailedException } from '../../../docker/docker.types';
import { DockerContainerArchiveReadLimitError } from '../../../docker/contracts/docker-container-archive.port';
import { RuntimeDataFilesService } from './runtime-data-files.service';
import { RuntimeFilePathService } from './runtime-file-path.service';
import { RuntimeUploadStreamService } from './runtime-upload-stream.service';

describe('RuntimeDataFilesService', () => {
  let archive: {
    copyFileToContainer: jest.Mock;
    readFileFromContainer: jest.Mock;
  };
  let exec: { execInContainerWithOutput: jest.Mock };
  let service: RuntimeDataFilesService;

  beforeEach(() => {
    archive = {
      copyFileToContainer: jest.fn(),
      readFileFromContainer: jest.fn(),
    };
    exec = {
      execInContainerWithOutput: jest.fn().mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      }),
    };
    const reconciler = {
      reconcileById: jest.fn().mockResolvedValue({
        id: 'app-1',
        containerId: 'container-1',
        status: AndroidApplicationStatus.Running,
      }),
    };
    service = new RuntimeDataFilesService(
      archive as never,
      exec as never,
      reconciler as never,
      new RuntimeFilePathService(),
      new RuntimeUploadStreamService(),
    );
  });

  const command = () =>
    (exec.execInContainerWithOutput.mock.calls.at(-1)?.[1] as string[])[2];

  it('lists one directory level without recursively counting children', async () => {
    exec.execInContainerWithOutput.mockResolvedValue({
      stdout:
        'directory\tPictures\t1700000000\t0\nfile\treadme.txt\t1700000100\t12\n',
      stderr: '',
      exitCode: 0,
    });

    const files = await service.listFiles('app-1', '/data/media/0');

    expect(files).toEqual([
      expect.objectContaining({
        name: 'Pictures',
        path: '/data/media/0/Pictures',
        type: 'directory',
        itemCount: null,
        sizeBytes: null,
      }),
      expect.objectContaining({
        name: 'readme.txt',
        type: 'file',
        sizeBytes: 12,
      }),
    ]);
    expect(command()).toContain('-mindepth 1 -maxdepth 1');
    expect(command()).not.toContain('find "$entry"');
  });

  it('creates, renames, and recursively deletes entries with quoted paths', async () => {
    const created = await service.createDirectory(
      'app-1',
      '/data/Documents',
      'Reports',
    );
    expect(created).toMatchObject({
      path: '/data/Documents/Reports',
      type: 'directory',
      itemCount: null,
    });
    expect(command()).toContain('mkdir "$target"');

    exec.execInContainerWithOutput.mockResolvedValueOnce({
      stdout: 'file\t1700000200\t42',
      stderr: '',
      exitCode: 0,
    });
    const renamed = await service.renameFile(
      'app-1',
      '/data/Documents/draft.txt',
      'final.txt',
    );
    expect(renamed).toMatchObject({
      path: '/data/Documents/final.txt',
      sizeBytes: 42,
    });
    expect(command()).toContain('mv "$source" "$target"');

    exec.execInContainerWithOutput.mockResolvedValueOnce({
      stdout: 'directory',
      stderr: '',
      exitCode: 0,
    });
    await expect(
      service.deleteFile('app-1', '/data/Documents/Reports'),
    ).resolves.toEqual({
      deleted: true,
      path: '/data/Documents/Reports',
      type: 'directory',
    });
    expect(command()).toContain('rm -rf "$source"');
  });

  it('rejects root mutations before invoking the container', async () => {
    await expect(service.deleteFile('app-1', '/data')).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(
      service.renameFile('app-1', '/data', 'renamed'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(exec.execInContainerWithOutput).not.toHaveBeenCalled();
  });

  it.each([
    [41, 'symbolic links'],
    [43, 'already exists'],
  ])(
    'maps guarded runtime command conflicts (%s)',
    async (exitCode, message) => {
      exec.execInContainerWithOutput.mockRejectedValue(
        new ContainerCommandFailedException({
          message: 'command failed',
          command: ['sh'],
          exitCode,
          stdout: null,
          stderr: null,
        }),
      );

      await expect(
        service.createDirectory('app-1', '/data', 'Documents'),
      ).rejects.toThrow(message);
    },
  );

  it('atomically publishes a non-overwrite upload from private staging', async () => {
    exec.execInContainerWithOutput.mockResolvedValueOnce({
      stdout: '/data/Documents',
      stderr: '',
      exitCode: 0,
    });

    const result = await service['storeRunningFileStream'](
      {
        id: 'app-1',
        containerId: 'container-1',
        status: AndroidApplicationStatus.Running,
      } as never,
      Readable.from([Buffer.from('payload')]),
      'report.txt',
      '/data/Documents',
      false,
    );

    expect(archive.copyFileToContainer).toHaveBeenCalledWith(
      'container-1',
      expect.any(String),
      expect.stringMatching(/^\/data\/Documents\/\.rebroid-upload-[0-9a-f-]+$/),
      'report.txt',
    );
    const scripts = exec.execInContainerWithOutput.mock.calls.map(
      (call) => (call[1] as string[])[2],
    );
    expect(scripts[1]).toContain('mkdir -m 700 "$staging_dir"');
    expect(scripts[2]).toContain('ln "$staged" "$parent"');
    expect(scripts[2]).toContain('exit 43');
    expect(scripts[3]).toContain('rm -rf "$staging_dir"');
    expect(result).toMatchObject({
      uploaded: true,
      name: 'report.txt',
      path: '/data/Documents/report.txt',
      sizeBytes: 7,
    });
  });

  it('maps a finalization race to conflict and removes upload staging', async () => {
    exec.execInContainerWithOutput
      .mockResolvedValueOnce({
        stdout: '/data/Documents',
        stderr: '',
        exitCode: 0,
      })
      .mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
      })
      .mockRejectedValueOnce(
        new ContainerCommandFailedException({
          message: 'target appeared before finalization',
          command: ['sh'],
          exitCode: 43,
          stdout: null,
          stderr: null,
        }),
      );

    await expect(
      service['storeRunningFileStream'](
        {
          id: 'app-1',
          containerId: 'container-1',
          status: AndroidApplicationStatus.Running,
        } as never,
        Readable.from([Buffer.from('payload')]),
        'report.txt',
        '/data/Documents',
        false,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(archive.copyFileToContainer).toHaveBeenCalledTimes(1);
    const cleanupCommand = (
      exec.execInContainerWithOutput.mock.calls.at(-1)?.[1] as string[]
    )[2];
    expect(cleanupCommand).toContain('rm -rf "$staging_dir"');
  });

  it('returns and caches a bounded WebP preview by modification time', async () => {
    const source = await sharp({
      create: {
        width: 1600,
        height: 1200,
        channels: 3,
        background: '#336699',
      },
    })
      .png()
      .toBuffer();
    exec.execInContainerWithOutput.mockResolvedValue({
      stdout: '/data/Pictures/photo.png\t1700000300',
      stderr: '',
      exitCode: 0,
    });
    archive.readFileFromContainer.mockResolvedValue(source);

    const first = await service.previewFile(
      'app-1',
      '/data/Pictures/photo.png',
    );
    const second = await service.previewFile(
      'app-1',
      '/data/Pictures/photo.png',
    );
    const metadata = await sharp(first.content).metadata();

    expect(metadata).toMatchObject({
      format: 'webp',
      width: 1280,
      height: 960,
    });
    expect(second.content).toBe(first.content);
    expect(archive.readFileFromContainer).toHaveBeenCalledTimes(1);
    expect(archive.readFileFromContainer).toHaveBeenCalledWith(
      'container-1',
      '/data/Pictures/photo.png',
      { maximumBytes: 25 * 1024 * 1024 },
    );
  });

  it('rejects unsupported preview media', async () => {
    exec.execInContainerWithOutput.mockResolvedValue({
      stdout: '/data/document.txt\t1700000400',
      stderr: '',
      exitCode: 0,
    });
    archive.readFileFromContainer.mockResolvedValue(
      Buffer.from('not an image'),
    );

    await expect(
      service.previewFile('app-1', '/data/document.txt'),
    ).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
  });

  it('maps the archive read ceiling to a payload-too-large response', async () => {
    exec.execInContainerWithOutput.mockResolvedValue({
      stdout: '/data/large.png\t1700000500',
      stderr: '',
      exitCode: 0,
    });
    archive.readFileFromContainer.mockRejectedValue(
      new DockerContainerArchiveReadLimitError(25 * 1024 * 1024),
    );

    await expect(
      service.previewFile('app-1', '/data/large.png'),
    ).rejects.toBeInstanceOf(PayloadTooLargeException);
  });
});
