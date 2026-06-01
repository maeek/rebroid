import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const assets = [
  {
    from: 'src/modules/display/viewer/index.html',
    to: 'dist/modules/display/viewer/index.html',
  },
  {
    from: 'src/modules/display/viewer/styles.css',
    to: 'dist/modules/display/viewer/assets/styles.css',
  },
];

await Promise.all(
  assets.map(async asset => {
    const target = join(process.cwd(), asset.to);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(join(process.cwd(), asset.from), target);
  }),
);
