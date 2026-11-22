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
import { AndroidAppsRuntimeOperationGate } from '../../common/services/android-apps-runtime-operation-gate.service';
import type { ApplicationRuntimeFileUploadDto } from '../dto/application-runtime-file.dto';

type RuntimeUploadConsumer = (
  stream: Readable,
  originalName: string,
) => Promise<ApplicationRuntimeFileUploadDto>;

@Injectable()
export class RuntimeUploadStreamService {
  readonly maxUploadBytes = 256 * 1024 * 1024;

  constructor(private readonly operations: AndroidAppsRuntimeOperationGate) {}

  consumeFileUpload(
    id: string,
    request: MultipartUploadRequest,
    prepare: () => Promise<RuntimeUploadConsumer>,
  ) {
    const controller = new AbortController();
    const canceledError = () =>
      new ConflictException('File upload was cancelled.');
    return this.operations.withApplicationOperation(
      id,
      async () => {
        const consume = await prepare();
        return consumeSingleFileUpload({
          request,
          signal: controller.signal,
          consume,
          fieldName: 'file',
          maxBytes: this.maxUploadBytes,
          missingError: () =>
            new ConflictException('A file upload is required.'),
          limitError: () => this.limitError(),
          canceledError,
        });
      },
      () => controller.abort(canceledError()),
    );
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
