import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import type { MultipartUploadRequest } from '../../common/http-upload';
import { ContainerImageBuildContextService } from './container-image-build-context.service';

it('keeps the context record until its file is gone and allows retry', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'rebroid-build-context-'));
  const files = {
    findOneBy: jest.fn().mockResolvedValue({ storedPath: directory }),
    delete: jest.fn(),
  };
  const service = new ContainerImageBuildContextService(
    files as never,
    {} as never,
  );
  try {
    await expect(service.removeFile('context')).rejects.toThrow();
    expect(files.delete).not.toHaveBeenCalled();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
  await expect(service.removeFile('context')).resolves.toEqual({
    id: 'context',
    removed: true,
  });
  expect(files.delete).toHaveBeenCalledWith('context');
});

it('removes the uploaded context file when saving its record fails', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'rebroid-build-context-'));
  try {
    const files = {
      create: jest.fn((value: unknown) => value),
      save: jest.fn().mockRejectedValue(new Error('save failed')),
    };
    const service = new ContainerImageBuildContextService(
      files as never,
      { getOrThrow: () => directory } as never,
    );
    const request = Readable.from([
      '--boundary\r\nContent-Disposition: form-data; name="file"; filename="test.txt"\r\n\r\ncontents\r\n--boundary--\r\n',
    ]) as MultipartUploadRequest;
    request.headers = {
      'content-type': 'multipart/form-data; boundary=boundary',
    };
    await expect(service.consumeUpload(request, 'test.txt')).rejects.toThrow(
      'save failed',
    );
    expect(await readdir(join(directory, 'image-build-context'))).toEqual([]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
