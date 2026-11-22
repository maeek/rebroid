import { ConflictException, Injectable } from '@nestjs/common';
import { type FileHandle, mkdtemp, open, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  type MultipartUploadRequest,
  consumeSingleFileUpload,
} from '../../../common/http-upload';
import { ApplicationRuntimeFileUploadDto } from '../dto/application-runtime-file.dto';

@Injectable()
export class RuntimeUploadStreamService {
  readonly maxUploadBytes = 256 * 1024 * 1024;

  consumeFileUpload(
    request: MultipartUploadRequest,
    store: (
      stream: Readable,
      originalName: string,
    ) => Promise<ApplicationRuntimeFileUploadDto>,
    signal?: AbortSignal,
  ) {
    return consumeSingleFileUpload({
      request,
      signal,
      fieldName: 'file',
      maxBytes: this.maxUploadBytes,
      missingError: () => new ConflictException('A file upload is required.'),
      limitError: () => this.limitError(),
      canceledError: () => new ConflictException('File upload was cancelled.'),
      consume: (stream, originalName) => store(stream, originalName),
    });
  }

  async withStagedFile(
    stream: Readable,
    store: (path: string, file: FileHandle) => Promise<void>,
    options: { directory?: string; mode?: number } = {},
  ) {
    const directory = await mkdtemp(
      join(options.directory ?? tmpdir(), '.rebroid-runtime-upload-'),
    );
    const path = join(directory, 'upload');
    try {
      await using file = await open(path, 'wx', options.mode ?? 0o600);
      let sizeBytes = 0;
      await pipeline(
        stream,
        new Transform({
          transform: (chunk: Buffer, _encoding, callback) => {
            sizeBytes += chunk.length;
            if (sizeBytes > this.maxUploadBytes) {
              callback(this.limitError());
            } else {
              callback(null, chunk);
            }
          },
        }),
        (chunks) => file.writeFile(chunks),
      );
      await store(path, file);
      return sizeBytes;
    } finally {
      await rm(path, { force: true }).catch(() => undefined);
      await rmdir(directory).catch(() => undefined);
    }
  }

  private limitError() {
    return new ConflictException(
      `File upload exceeds the ${this.maxUploadBytes / 1024 / 1024} MB limit.`,
    );
  }
}
