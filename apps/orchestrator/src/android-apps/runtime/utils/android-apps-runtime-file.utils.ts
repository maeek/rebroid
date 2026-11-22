import { ConflictException } from '@nestjs/common';
import { basename, posix } from 'node:path';

export const isRuntimeDownloadFileName = (name: string) =>
  name.length > 0 &&
  name === name.trim() &&
  name !== '.' &&
  name !== '..' &&
  !name.includes('/') &&
  !name.includes('\\') &&
  !name.includes('\0');

export const sanitizeRuntimeFileName = (fileName: string) => {
  const normalized = basename(fileName.replace(/\\/g, '/')).trim();
  if (!isRuntimeDownloadFileName(normalized))
    throw new ConflictException('Invalid file name.');
  return normalized;
};

export const runtimeFileEntry = (
  name: string,
  path: string,
  type: 'file' | 'directory',
  sizeBytes: number | null,
  modifiedSeconds = Math.floor(Date.now() / 1000),
) => ({
  name,
  path,
  type,
  sizeBytes: type === 'file' ? sizeBytes : null,
  itemCount: null,
  modifiedAt:
    modifiedSeconds > 0 ? new Date(modifiedSeconds * 1000).toJSON() : null,
});

export const uploadedRuntimeFile = (
  directory: string,
  name: string,
  sizeBytes: number,
) => ({
  uploaded: true,
  name,
  path: posix.join(directory, name),
  type: 'file' as const,
  sizeBytes,
  itemCount: null,
  modifiedAt: new Date().toISOString(),
});

export const parseDownloadFiles = (stdout: string, downloadDirectory: string) =>
  stdout.split('\n').flatMap((line) => {
    const [name, size, modified] = line.split('\t');
    if (!name || !isRuntimeDownloadFileName(name)) return [];
    return runtimeFileEntry(
      name,
      `${downloadDirectory}/${name}`,
      'file',
      Number(size) || 0,
      Number(modified),
    );
  });
