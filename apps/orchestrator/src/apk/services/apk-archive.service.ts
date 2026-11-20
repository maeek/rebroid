import { Injectable } from '@nestjs/common';
import yauzl, { type Entry, type ZipFile } from 'yauzl';
import { ZipEntry } from '../types/apk.types';

export interface ApkArchiveReader {
  entries: ZipEntry[];
  readEntry(name: string, maxBytes: number): Promise<Buffer | null>;
}

@Injectable()
export class ApkArchiveService {
  async withEntries<T>(
    filePath: string,
    read: (archive: ApkArchiveReader) => Promise<T>,
  ): Promise<T> {
    const archive = await openApkArchive(filePath);
    try {
      const entries: ZipEntry[] = [];
      const firstEntryByName = new Map<string, Entry>();
      await new Promise<void>((resolve, reject) => {
        archive.on('error', reject);
        archive.on('entry', (entry: Entry) => {
          if (!entry.fileName.endsWith('/')) {
            entries.push({
              name: entry.fileName,
              uncompressedSize: entry.uncompressedSize,
            });
            // A name lookup has always returned the first matching ZIP entry.
            if (!firstEntryByName.has(entry.fileName))
              firstEntryByName.set(entry.fileName, entry);
          }
          archive.readEntry();
        });
        archive.once('end', resolve);
        archive.readEntry();
      });

      return await read({
        entries,
        readEntry: (name, maxBytes) =>
          readBoundedEntry(archive, firstEntryByName.get(name), maxBytes),
      });
    } finally {
      archive.close();
    }
  }

  async readEntry(filePath: string, name: string, maxBytes: number) {
    const archive = await openApkArchive(filePath);
    try {
      const entry = await new Promise<Entry | undefined>((resolve, reject) => {
        archive.on('error', reject);
        archive.on('entry', (candidate: Entry) => {
          if (candidate.fileName === name) resolve(candidate);
          else archive.readEntry();
        });
        archive.once('end', () => resolve(undefined));
        archive.readEntry();
      });
      return await readBoundedEntry(archive, entry, maxBytes);
    } finally {
      archive.close();
    }
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

function openApkArchive(filePath: string): Promise<ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.open(
      filePath,
      { lazyEntries: true, autoClose: false },
      (error, archive) => {
        if (error || !archive)
          reject(error ?? new Error('Could not open APK archive.'));
        else resolve(archive);
      },
    );
  });
}

async function readBoundedEntry(
  archive: ZipFile,
  entry: Entry | undefined,
  maxBytes: number,
): Promise<Buffer | null> {
  if (!entry) return null;
  const tooLarge = () =>
    new Error(`APK entry "${entry.fileName}" is too large.`);
  if (entry.uncompressedSize > maxBytes) throw tooLarge();

  const stream = await new Promise<NodeJS.ReadableStream>((resolve, reject) => {
    archive.openReadStream(entry, (error, stream) => {
      if (error || !stream)
        reject(error ?? new Error(`Could not read "${entry.fileName}".`));
      else resolve(stream);
    });
  });
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > maxBytes) throw tooLarge();
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, size);
}
