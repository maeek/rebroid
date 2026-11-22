import { ConflictException } from '@nestjs/common';
import { posix } from 'node:path';

const dataDirectory = '/data';
export const downloadSubdirectories = ['media', '0', 'Download'] as const;
export const downloadDirectory = posix.join(
  dataDirectory,
  ...downloadSubdirectories,
);

export function normalizeDataPath(requestedPath?: string) {
  const normalized = posix
    .normalize(requestedPath?.trim() || dataDirectory)
    .replace(/\/$/, '');
  if (
    normalized.includes('\0') ||
    (!normalized.startsWith(`${dataDirectory}/`) &&
      normalized !== dataDirectory)
  ) {
    throw new ConflictException('Path must be inside the runtime data volume.');
  }
  return normalized;
}

export function normalizeEntryName(value: string) {
  const normalized = value.trim();
  const hasControlCharacter = [...normalized].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint === 127;
  });
  if (
    !normalized ||
    normalized === '.' ||
    normalized === '..' ||
    normalized.includes('/') ||
    normalized.includes('\\') ||
    hasControlCharacter
  ) {
    throw new ConflictException('Invalid file or directory name.');
  }
  return normalized;
}

export function normalizeEntryPath(requestedPath?: string) {
  const path = normalizeDataPath(requestedPath);
  if (path === dataDirectory) {
    throw new ConflictException('The runtime data root cannot be changed.');
  }
  return path;
}
