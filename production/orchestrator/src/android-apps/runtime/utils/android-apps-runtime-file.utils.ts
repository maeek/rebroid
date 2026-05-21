import { ConflictException } from '@nestjs/common';
import { basename } from 'node:path';

export const sanitizeRuntimeFileName = (fileName: string) => {
  const normalized = basename(fileName.replace(/\\/g, '/')).trim();
  if (
    !normalized ||
    normalized === '.' ||
    normalized === '..' ||
    normalized.includes('/') ||
    normalized.includes('\\') ||
    normalized.includes('\0')
  ) {
    throw new ConflictException('Invalid file name.');
  }

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
        sizeBytes: Number(size) || 0,
        modifiedAt:
          Number.isFinite(modifiedSeconds) && modifiedSeconds > 0
            ? new Date(modifiedSeconds * 1000).toISOString()
            : null,
      };
    })
    .filter((file) => file.name.length > 0);
};
