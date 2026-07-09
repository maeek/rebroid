import { ConflictException } from '@nestjs/common';
import type { IncomingHttpHeaders, IncomingMessage } from 'node:http';
import type { Readable } from 'node:stream';
import Busboy from 'busboy';

export type MultipartUploadRequest = Readable & {
  headers: IncomingHttpHeaders;
  on: IncomingMessage['on'];
};

export type BufferedUploadFile = {
  originalname: string;
  buffer: Buffer;
  size: number;
};

export const isMultipartUpload = (headers: IncomingHttpHeaders) => {
  const contentType = headers['content-type'];
  const value = Array.isArray(contentType) ? contentType[0] : contentType;
  return value?.toLowerCase().startsWith('multipart/form-data') ?? false;
};

export const assertMultipartUpload = (request: MultipartUploadRequest) => {
  if (!isMultipartUpload(request.headers)) {
    throw new ConflictException('A multipart file upload is required.');
  }
};

interface SingleFileUploadOptions<Result> {
  request: MultipartUploadRequest;
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
  fieldName,
  maxBytes,
  missingError,
  limitError,
  canceledError,
  consume,
}: SingleFileUploadOptions<Result>) => {
  assertMultipartUpload(request);
  const parser = Busboy({
    headers: request.headers,
    limits: { files: 1, fileSize: maxBytes },
  });

  return new Promise<Result>((resolve, reject) => {
    let upload: Promise<Result> | null = null;
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      callback();
    };
    const fail = (error: unknown) => finish(() => reject(error));

    parser.on('file', (receivedFieldName, stream, info) => {
      if (receivedFieldName !== fieldName || upload) {
        stream.resume();
        return;
      }
      let exceededLimit = false;
      stream.on('limit', () => {
        exceededLimit = true;
        const error = limitError();
        fail(error);
        stream.destroy(error);
      });
      upload = consume(stream, info.filename || 'upload', () => exceededLimit);
      upload.catch(fail);
    });
    parser.on('error', fail);
    request.on('aborted', () => fail(canceledError()));
    request.on('error', fail);
    parser.on('finish', () => {
      if (!upload) {
        fail(missingError());
        return;
      }
      upload.then((result) => finish(() => resolve(result)), fail);
    });
    request.pipe(parser);
  });
};
