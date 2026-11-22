import { ConflictException, Injectable } from '@nestjs/common';
import { posix } from 'node:path';

@Injectable()
export class RuntimeFilePathService {
  readonly dataDirectory = '/data';
  readonly downloadDirectory = '/data/media/0/Download';

  normalizeDataPath(requestedPath?: string) {
    const normalized = posix
      .normalize(requestedPath?.trim() || this.dataDirectory)
      .replace(/\/$/, '');
    if (
      normalized.includes('\0') ||
      (!normalized.startsWith(`${this.dataDirectory}/`) &&
        normalized !== this.dataDirectory)
    ) {
      throw new ConflictException(
        'Path must be inside the runtime data volume.',
      );
    }
    return normalized;
  }

  normalizeEntryName(value: string) {
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

  normalizeEntryPath(requestedPath?: string) {
    const path = this.normalizeDataPath(requestedPath);
    if (path === this.dataDirectory) {
      throw new ConflictException('The runtime data root cannot be changed.');
    }
    return path;
  }

  shellQuote(value: string) {
    return `'${value.replaceAll("'", "'\\''")}'`;
  }
}
