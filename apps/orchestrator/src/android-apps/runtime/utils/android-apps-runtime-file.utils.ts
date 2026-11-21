import { ConflictException } from '@nestjs/common';
import { basename } from 'node:path';

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

export const parseDownloadFiles = (
  stdout: string,
  downloadDirectory: string,
) => {
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, size, modified] = line.split('\t');
      const modifiedSeconds = Number(modified);
      return {
        name: name ?? '',
        path: `${downloadDirectory}/${name ?? ''}`,
        type: 'file' as const,
        sizeBytes: Number(size) || 0,
        itemCount: null,
        modifiedAt:
          Number.isFinite(modifiedSeconds) && modifiedSeconds > 0
            ? new Date(modifiedSeconds * 1000).toISOString()
            : null,
      };
    })
    .filter((file) => file.name.length > 0);
};
