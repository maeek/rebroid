import { sanitizeBuildContextPath } from './container-image-build-paths';

describe('sanitizeBuildContextPath', () => {
  it('accepts normalized relative POSIX paths', () => {
    expect(sanitizeBuildContextPath('apks/../apks/GmsCore.apk')).toBe(
      'apks/GmsCore.apk',
    );
  });

  it('rejects absolute paths and traversal', () => {
    expect(() => sanitizeBuildContextPath('/tmp/file')).toThrow(
      /relative POSIX path/,
    );
    expect(() => sanitizeBuildContextPath('../secret')).toThrow(/traverse/);
    expect(() => sanitizeBuildContextPath('apks\\GmsCore.apk')).toThrow(
      /relative POSIX path/,
    );
  });
});
