import { ConflictException } from '@nestjs/common';
import {
  normalizeDataPath,
  normalizeEntryName,
  normalizeEntryPath,
} from './runtime-file-path';

describe('runtime file paths', () => {
  it('normalizes paths contained by the runtime data root', () => {
    expect(normalizeDataPath()).toBe('/data');
    expect(normalizeDataPath('/data/media/0/../0/Pictures')).toBe(
      '/data/media/0/Pictures',
    );
  });

  it.each([
    '/data/../../etc/passwd',
    '/etc/passwd',
    'data/media/0',
    '/data/file\0name',
  ])('rejects a path that can escape /data: %s', (path) => {
    expect(() => normalizeDataPath(path)).toThrow(ConflictException);
  });

  it.each(['', '.', '..', 'nested/name', 'nested\\name', 'line\nbreak'])(
    'rejects an unsafe entry name: %s',
    (name) => {
      expect(() => normalizeEntryName(name)).toThrow(ConflictException);
    },
  );

  it('protects the runtime data root from mutation', () => {
    expect(() => normalizeEntryPath('/data/')).toThrow(ConflictException);
    expect(normalizeEntryPath('/data/Documents/')).toBe('/data/Documents');
  });
});
