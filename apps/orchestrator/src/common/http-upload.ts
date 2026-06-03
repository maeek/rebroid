import { ConflictException } from '@nestjs/common';
import type { IncomingHttpHeaders, IncomingMessage } from 'node:http';
import type { Readable } from 'node:stream';

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
