import { ConflictException } from '@nestjs/common';
import { RuntimeFilePathService } from './runtime-file-path.service';

describe('RuntimeFilePathService', () => {
  const service = new RuntimeFilePathService();

  it('normalizes paths contained by the runtime data root', () => {
    expect(service.normalizeDataPath()).toBe('/data');
    expect(service.normalizeDataPath('/data/media/0/../0/Pictures')).toBe(
      '/data/media/0/Pictures',
    );
  });

  it.each([
    '/data/../../etc/passwd',
    '/etc/passwd',
    'data/media/0',
    '/data/file\0name',
  ])('rejects a path that can escape /data: %s', (path) => {
    expect(() => service.normalizeDataPath(path)).toThrow(ConflictException);
  });

  it.each(['', '.', '..', 'nested/name', 'nested\\name', 'line\nbreak'])(
    'rejects an unsafe entry name: %s',
    (name) => {
      expect(() => service.normalizeEntryName(name)).toThrow(ConflictException);
    },
  );

  it('protects the runtime data root from mutation', () => {
    expect(() => service.assertMutablePath('/data')).toThrow(ConflictException);
    expect(() => service.assertMutablePath('/data/Documents')).not.toThrow();
  });

  it('quotes shell paths without exposing quote boundaries', () => {
    expect(service.shellQuote("/data/owner's file")).toBe(
      "'/data/owner'\\''s file'",
    );
  });
});
