import { rm } from 'node:fs/promises';
import { join } from 'node:path';

await rm(join(process.cwd(), 'dist/modules/display/viewer'), {
  recursive: true,
  force: true,
});
