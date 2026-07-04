import { ConflictException } from '@nestjs/common';
import { posix } from 'node:path';

export const sanitizeBuildContextPath = (value: string) => {
  const raw = value.trim();
  if (!raw) {
    throw new ConflictException('Build context path is required.');
  }
  if (raw.includes('\0') || raw.includes('\\') || raw.startsWith('/')) {
    throw new ConflictException(
      'Build context path must be a relative POSIX path.',
    );
  }

  const normalized = posix.normalize(raw);
  const parts = normalized.split('/');
  if (
    normalized === '.' ||
    normalized.startsWith('../') ||
    parts.some((part) => part === '..' || part === '')
  ) {
    throw new ConflictException(
      'Build context path cannot traverse directories.',
    );
  }

  return normalized;
};
