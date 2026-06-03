import { ConflictException, Injectable } from '@nestjs/common';
import Busboy from 'busboy';
import { Readable, Transform, type TransformCallback } from 'node:stream';
import {
  type MultipartUploadRequest,
  assertMultipartUpload,
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
    assertMultipartUpload(request);

    const parser = Busboy({
      headers: request.headers,
      limits: {
        files: 1,
        fileSize: this.maxUploadBytes,
      },
    });

    return new Promise<ApplicationRuntimeFileUploadDto>((resolve, reject) => {
      let upload: Promise<ApplicationRuntimeFileUploadDto> | null = null;
      let settled = false;

      const finish = (callback: () => void) => {
        if (settled) {
          return;
        }

        settled = true;
        callback();
      };

      const fail = (error: unknown) => {
        finish(() => {
          reject(error);
        });
      };

      parser.on('file', (fieldName, stream, info) => {
        if (fieldName !== 'file' || upload) {
          stream.resume();
          return;
        }

        stream.on('limit', () => {
          fail(
            new ConflictException(
              `File upload exceeds the ${this.maxUploadBytes / 1024 / 1024} MB limit.`,
            ),
          );
        });

        upload = store(stream, info.filename || 'upload');
        upload.catch(fail);
      });

      parser.on('error', fail);
      request.on('aborted', () => {
        fail(new ConflictException('File upload was cancelled.'));
      });
      request.on('error', fail);
      parser.on('finish', () => {
        if (!upload) {
          fail(new ConflictException('A file upload is required.'));
          return;
        }

        upload.then((result) => {
          finish(() => {
            resolve(result);
          });
        }, fail);
      });

      request.pipe(parser);
    });
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
