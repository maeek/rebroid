import { isAbsolute, posix } from 'node:path';

export const validateGappsArchivePath = (value: string) => {
  if (!value || value.includes('\\') || isAbsolute(value)) {
    throw new Error(`GApps package contains an unsafe path: ${value}`);
  }
  const parts = value.split('/').filter(Boolean);
  if (parts.some((part) => part === '.' || part === '..')) {
    throw new Error(`GApps package contains path traversal: ${value}`);
  }
  return parts.join('/');
};

export const gappsSystemRelativePath = (archivePath: string) => {
  const parts = archivePath.split('/');
  const systemIndex = parts.indexOf('system');
  if (systemIndex < 0) return null;
  return parts.slice(systemIndex).join('/');
};

export const rejectGappsSymlinkParent = (
  path: string,
  symlinks: ReadonlySet<string>,
) => {
  const parts = path.split('/');
  if (symlinks.has(path)) {
    throw new Error(`GApps package contains a duplicate symlink path: ${path}`);
  }
  for (let index = 1; index < parts.length; index += 1) {
    if (symlinks.has(parts.slice(0, index).join('/'))) {
      throw new Error(`GApps package entry is nested under a symlink: ${path}`);
    }
  }
};

export const validateGappsSymlinkTarget = (path: string, target: string) => {
  if (!target || target.includes('\\') || posix.isAbsolute(target)) {
    throw new Error(`GApps package contains an unsafe symlink: ${path}`);
  }
  // Only climb before descending into components that might themselves be symlinks.
  const components = target.split('/').filter((part) => part && part !== '.');
  const firstDescent = components.findIndex((part) => part !== '..');
  if (firstDescent !== -1 && components.slice(firstDescent).includes('..')) {
    throw new Error(`GApps package contains an ambiguous symlink: ${path}`);
  }
  const resolved = posix.normalize(posix.join(posix.dirname(path), target));
  const fromRoot = posix.relative('system', resolved);
  if (fromRoot === '..' || fromRoot.startsWith('../')) {
    throw new Error(`GApps package symlink escapes the system tree: ${path}`);
  }
};
