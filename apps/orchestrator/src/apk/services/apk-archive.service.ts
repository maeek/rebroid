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

  scanAsciiPatterns(
    filePath: string,
    entryPattern: RegExp,
    patterns: readonly string[],
    maxBytes: number,
  ) {
    return new Promise<Set<string>>((resolve, reject) => {
      yauzl.open(filePath, { lazyEntries: true }, (openError, archive) => {
        if (openError || !archive) {
          reject(openError ?? new Error('Could not open APK archive.'));
          return;
        }

        const found = new Set<string>();
        const patternBuffers = patterns.map((pattern) => ({
          pattern,
          buffer: Buffer.from(pattern),
        }));
        const carryLength = Math.max(
          0,
          ...patternBuffers.map(({ buffer }) => buffer.length - 1),
        );
        let scannedBytes = 0;
        let settled = false;
        const finish = (callback: () => void) => {
          if (settled) return;
          settled = true;
          archive.close();
          callback();
        };

        archive.on('error', (error) => finish(() => reject(error)));
        archive.on('entry', (entry: Entry) => {
          if (!entryPattern.test(entry.fileName)) {
            archive.readEntry();
            return;
          }
          if (scannedBytes + entry.uncompressedSize > maxBytes) {
            finish(() => reject(new Error('APK DEX scan limit exceeded.')));
            return;
          }

          archive.openReadStream(entry, (streamError, stream) => {
            if (streamError || !stream) {
              finish(() =>
                reject(
                  streamError ?? new Error(`Could not scan ${entry.fileName}.`),
                ),
              );
              return;
            }
            let carry: Buffer<ArrayBufferLike> = Buffer.alloc(0);
            stream.on('data', (chunk: Buffer) => {
              scannedBytes += chunk.length;
              if (scannedBytes > maxBytes) {
                stream.destroy(new Error('APK DEX scan limit exceeded.'));
                return;
              }
              const searchable = carry.length
                ? Buffer.concat([carry, chunk])
                : chunk;
              for (const candidate of patternBuffers) {
                if (searchable.includes(candidate.buffer)) {
                  found.add(candidate.pattern);
                }
              }
              carry = searchable.subarray(
                Math.max(0, searchable.length - carryLength),
              );
            });
            stream.on('error', (error) => finish(() => reject(error)));
            stream.on('end', () => archive.readEntry());
          });
        });
        archive.on('end', () => finish(() => resolve(found)));
        archive.readEntry();
      });
    });
  }
}
