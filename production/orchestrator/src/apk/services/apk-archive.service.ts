import { Injectable } from '@nestjs/common';
import yauzl, { type Entry } from 'yauzl';
import { ZipEntry } from '../types/apk.types';

@Injectable()
export class ApkArchiveService {
  listEntries(filePath: string) {
    return new Promise<ZipEntry[]>((resolve, reject) => {
      yauzl.open(filePath, { lazyEntries: true }, (openError, archive) => {
        if (openError || !archive) {
          reject(openError ?? new Error('Could not open APK archive.'));
          return;
        }

        const entries: ZipEntry[] = [];
        archive.on('error', reject);
        archive.on('entry', (entry: Entry) => {
          if (!entry.fileName.endsWith('/')) {
            entries.push({
              name: entry.fileName,
              compressionMethod: entry.compressionMethod,
              compressedSize: entry.compressedSize,
              uncompressedSize: entry.uncompressedSize,
              localHeaderOffset: entry.relativeOffsetOfLocalHeader,
            });
          }
          archive.readEntry();
        });
        archive.on('end', () => resolve(entries));
        archive.readEntry();
      });
    });
  }

  readEntry(filePath: string, name: string, maxBytes: number) {
    return new Promise<Buffer | null>((resolve, reject) => {
      yauzl.open(filePath, { lazyEntries: true }, (openError, archive) => {
        if (openError || !archive) {
          reject(openError ?? new Error('Could not open APK archive.'));
          return;
        }

        let settled = false;
        const finish = (callback: () => void) => {
          if (settled) {
            return;
          }
          settled = true;
          archive.close();
          callback();
        };
        archive.on('error', (error) => finish(() => reject(error)));
        archive.on('entry', (entry: Entry) => {
          if (entry.fileName !== name) {
            archive.readEntry();
            return;
          }
          if (entry.uncompressedSize > maxBytes) {
            finish(() =>
              reject(new Error(`APK entry "${name}" is too large.`)),
            );
            return;
          }

          archive.openReadStream(entry, (streamError, stream) => {
            if (streamError || !stream) {
              finish(() =>
                reject(streamError ?? new Error(`Could not read "${name}".`)),
              );
              return;
            }

            const chunks: Buffer[] = [];
            let size = 0;
            stream.on('data', (chunk: Buffer) => {
              size += chunk.length;
              if (size > maxBytes) {
                stream.destroy(new Error(`APK entry "${name}" is too large.`));
                return;
              }
              chunks.push(chunk);
            });
            stream.on('error', (error) => finish(() => reject(error)));
            stream.on('end', () =>
              finish(() => resolve(Buffer.concat(chunks, size))),
            );
          });
        });
        archive.on('end', () => finish(() => resolve(null)));
        archive.readEntry();
      });
    });
  }
}
