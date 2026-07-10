import {
  gappsSystemRelativePath,
  rejectGappsSymlinkParent,
  validateGappsArchivePath,
  validateGappsSymlinkTarget,
} from './gapps-package-paths';

describe('GApps package path validation', () => {
  it('locates a nested system tree', () => {
    expect(gappsSystemRelativePath('payload/system/product/app/App.apk')).toBe(
      'system/product/app/App.apk',
    );
    expect(gappsSystemRelativePath('META-INF/MANIFEST.MF')).toBeNull();
  });

  it.each([
    '../system/app.apk',
    '/system/app.apk',
    'system/../app.apk',
    'system\\app.apk',
  ])('rejects unsafe archive path %s', (path) => {
    expect(() => validateGappsArchivePath(path)).toThrow();
  });

  it('allows relative in-tree symlinks and rejects escaping targets', () => {
    expect(() =>
      validateGappsSymlinkTarget('system/product', 'product'),
    ).not.toThrow();
    expect(() =>
      validateGappsSymlinkTarget('system/product/app', '../../../outside'),
    ).toThrow(/escapes/);
    expect(() =>
      validateGappsSymlinkTarget('system/product', '/product'),
    ).toThrow(/unsafe/);
  });

  it('rejects archive entries placed below an extracted symlink', () => {
    expect(() =>
      rejectGappsSymlinkParent(
        'system/product/app/App.apk',
        new Set(['system/product']),
      ),
    ).toThrow(/nested under a symlink/);
  });
});
