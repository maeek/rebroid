import { readdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const assetsDirectory = join(process.cwd(), 'dist/modules/display/viewer/assets');

const withBrowserExtension = specifier => {
  if (!specifier.startsWith('./') || extname(specifier)) {
    return specifier;
  }

  return `${specifier}.js`;
};

const rewriteImports = content =>
  content.replace(
    /\b(from\s+["'])(\.\/[^"']+)(["'])/g,
    (_match, prefix, specifier, suffix) =>
      `${prefix}${withBrowserExtension(specifier)}${suffix}`,
  );

const entries = await readdir(assetsDirectory, { withFileTypes: true });
await Promise.all(
  entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.js'))
    .map(async entry => {
      const path = join(assetsDirectory, entry.name);
      const content = await readFile(path, 'utf8');
      await writeFile(path, rewriteImports(content));
    }),
);
