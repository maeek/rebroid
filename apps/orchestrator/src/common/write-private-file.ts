import { randomUUID } from 'node:crypto';
import { open, rename, rm } from 'node:fs/promises';

export async function writePrivateFile(
  path: string,
  content: string | Buffer,
  {
    revision = randomUUID(),
    isCurrent,
  }: {
    revision?: ReturnType<typeof randomUUID>;
    isCurrent?: () => Promise<boolean>;
  } = {},
) {
  const temporary = `${path}.${revision}.tmp`;
  const file = await open(temporary, 'wx', 0o600);
  let published = false;
  try {
    try {
      await file.writeFile(content);
    } finally {
      await file.close();
    }
    if (!isCurrent || (await isCurrent())) {
      await rename(temporary, path);
      published = true;
    }
  } finally {
    if (!published) await rm(temporary, { force: true });
  }
}
