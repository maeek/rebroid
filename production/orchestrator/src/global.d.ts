/// <reference types="multer" />

declare module 'busboy' {
  import type { IncomingHttpHeaders } from 'node:http';
  import type { Readable } from 'node:stream';

  type FileInfo = {
    filename: string;
    encoding: string;
    mimeType: string;
  };

  type BusboyInstance = NodeJS.WritableStream & {
    on(
      event: 'file',
      listener: (name: string, stream: Readable, info: FileInfo) => void,
    ): BusboyInstance;
    on(
      event: 'field',
      listener: (name: string, value: string) => void,
    ): BusboyInstance;
    on(event: 'finish', listener: () => void): BusboyInstance;
    on(event: 'error', listener: (error: Error) => void): BusboyInstance;
  };

  type BusboyOptions = {
    headers: IncomingHttpHeaders;
    limits?: {
      files?: number;
      fileSize?: number;
    };
  };

  function busboy(options: BusboyOptions): BusboyInstance;
  export = busboy;
}
