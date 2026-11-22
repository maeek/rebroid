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
    const archive = await yauzl.openPromise(filePath, { autoClose: false });
    try {
      const entries: ZipEntry[] = [];
      const firstEntryByName = new Map<string, Entry>();
      for await (const entry of archive.eachEntry()) {
        if (entry.fileName.endsWith('/')) continue;
        entries.push({
          name: entry.fileName,
          uncompressedSize: entry.uncompressedSize,
        });
        // A name lookup has always returned the first matching ZIP entry.
        if (!firstEntryByName.has(entry.fileName))
          firstEntryByName.set(entry.fileName, entry);
      }

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
    const archive = await yauzl.openPromise(filePath);
    for await (const entry of archive.eachEntry()) {
      if (entry.fileName === name)
        return await readBoundedEntry(archive, entry, maxBytes);
    }
    return null;
  }

  async scanAsciiPatterns(
    filePath: string,
    entryPattern: RegExp,
    patterns: readonly string[],
    maxBytes: number,
  ) {
    const found = new Set<string>();
    const needles = patterns.map((pattern) => ({
      pattern,
      bytes: Buffer.from(pattern),
    }));
    const overlap = Math.max(
      0,
      ...needles.map(({ bytes }) => bytes.length - 1),
    );
    const archive = await yauzl.openPromise(filePath);
    let scannedBytes = 0;
    for await (const entry of archive.eachEntry()) {
      if (!entryPattern.test(entry.fileName)) continue;
      if (scannedBytes + entry.uncompressedSize > maxBytes)
        throw new Error('APK DEX scan limit exceeded.');
      let carry: Buffer<ArrayBufferLike> = Buffer.alloc(0);
      const stream = await archive.openReadStreamPromise(entry);
      for await (const chunk of stream as AsyncIterable<Buffer>) {
        scannedBytes += chunk.length;
        if (scannedBytes > maxBytes)
          throw new Error('APK DEX scan limit exceeded.');
        const searchable = carry.length ? Buffer.concat([carry, chunk]) : chunk;
        for (const { pattern, bytes } of needles) {
          if (searchable.includes(bytes)) found.add(pattern);
        }
        carry = searchable.subarray(Math.max(0, searchable.length - overlap));
      }
    }
    return found;
  }
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

  const stream = await archive.openReadStreamPromise(entry);
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > maxBytes) throw tooLarge();
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, size);
}
