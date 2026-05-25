import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const assets = [
  {
    from: 'src/modules/display/display-viewer.html',
    to: 'dist/modules/display/display-viewer.html',
  },
];

await Promise.all(
  assets.map(async asset => {
    const target = join(process.cwd(), asset.to);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(join(process.cwd(), asset.from), target);
  }),
);
