import { ConflictException } from '@nestjs/common';
import type { IncomingHttpHeaders } from 'node:http';
import type { Readable } from 'node:stream';
import Busboy from 'busboy';

export type MultipartUploadRequest = Readable & {
  headers: IncomingHttpHeaders;
};

const isMultipartUpload = (headers: IncomingHttpHeaders) => {
  const contentType = headers['content-type'];
  const value = Array.isArray(contentType) ? contentType[0] : contentType;
  return value?.toLowerCase().startsWith('multipart/form-data') ?? false;
};

const assertMultipartUpload = (request: MultipartUploadRequest) => {
  if (!isMultipartUpload(request.headers)) {
    throw new ConflictException('A multipart file upload is required.');
  }
};

interface SingleFileUploadOptions<Result> {
  request: MultipartUploadRequest;
  signal?: AbortSignal;
  fieldName: string;
  maxBytes: number;
  missingError: () => Error;
  limitError: () => Error;
  canceledError: () => Error;
  consume: (
    stream: Readable,
    originalName: string,
    limitExceeded: () => boolean,
  ) => Promise<Result>;
}

export const consumeSingleFileUpload = <Result>({
  request,
  signal,
  fieldName,
  maxBytes,
  missingError,
  limitError,
  canceledError,
  consume,
}: SingleFileUploadOptions<Result>) => {
  signal?.throwIfAborted();
  assertMultipartUpload(request);
  const parser = Busboy({
    headers: request.headers,
    // Busboy emits its limit event on equality. The configured maximum is inclusive.
    limits: { files: 1, fileSize: maxBytes + 1 },
  });

  let upload: Promise<Result> | null = null;
  const inputCanceled = () => {
    parser.destroy(canceledError());
  };
  return new Promise<Result>((resolve, reject) => {
    const stop = (error: Error) => {
      reject(error);
      request.unpipe(parser);
      parser.destroy(error);
      request.resume();
    };

    parser.on('file', (receivedFieldName, stream, info) => {
      stream.on('error', stop);
      if (receivedFieldName !== fieldName || upload) {
        stream.resume();
        return;
      }
      let exceededLimit = false;
      stream.on('limit', () => {
        exceededLimit = true;
        const error = limitError();
        reject(error);
        stream.destroy(error);
      });
      upload = consume(stream, info.filename || 'upload', () => exceededLimit);
      upload.catch(stop);
    });
    parser.on('error', stop);
    request.on('aborted', inputCanceled);
    signal?.addEventListener('abort', inputCanceled, { once: true });
    request.on('error', stop);
    parser.on('finish', () => {
      if (!upload) {
        reject(missingError());
        return;
      }
      upload.then(resolve, reject);
    });
    request.pipe(parser);
  }).finally(async () => {
    signal?.removeEventListener('abort', inputCanceled);
    request.off('aborted', inputCanceled);
    // A rejected request may still own an in-flight write and its staged file.
    await upload?.catch(() => undefined);
  });
};
