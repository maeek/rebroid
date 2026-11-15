import { ConflictException, Injectable } from '@nestjs/common';
import { createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Transform, type TransformCallback } from 'node:stream';
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
  ) {
    return consumeSingleFileUpload({
      request,
      fieldName: 'file',
      maxBytes: this.maxUploadBytes,
      missingError: () => new ConflictException('A file upload is required.'),
      limitError: () =>
        new ConflictException(
          `File upload exceeds the ${this.maxUploadBytes / 1024 / 1024} MB limit.`,
        ),
      canceledError: () => new ConflictException('File upload was cancelled.'),
      consume: (stream, originalName) => store(stream, originalName),
    });
  }

  async withStagedFile(
    stream: Readable,
    store: (path: string) => Promise<void>,
  ) {
    const directory = await mkdtemp(join(tmpdir(), 'rebroid-runtime-upload-'));
    try {
      const path = join(directory, 'upload');
      let sizeBytes = 0;
      await pipeline(
        stream,
        this.createByteCounter((bytes) => {
          sizeBytes += bytes;
        }),
        createWriteStream(path, { mode: 0o600 }),
      );
      await store(path);
      return sizeBytes;
    } finally {
      await rm(directory, { recursive: true, force: true }).catch(
        () => undefined,
      );
    }
  }

  createByteCounter(onBytes: (bytes: number) => void) {
    let totalBytes = 0;
    return new Transform({
      transform: (
        chunk: Buffer,
        _encoding: BufferEncoding,
        callback: TransformCallback,
      ) => {
        const bytes = Buffer.isBuffer(chunk)
          ? chunk.length
          : Buffer.byteLength(chunk);
        totalBytes += bytes;
        if (totalBytes > this.maxUploadBytes) {
          callback(
            new ConflictException(
              `File upload exceeds the ${this.maxUploadBytes / 1024 / 1024} MB limit.`,
            ),
          );
          return;
        }
        onBytes(bytes);
        callback(null, chunk);
      },
    });
  }
}
