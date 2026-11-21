import { ConfigService } from '@nestjs/config';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applicationLogMaxBytes } from '../utils/application-log-tail';
import { AndroidAppsLogService } from './android-apps-log.service';

describe('bounded application lifecycle log tails', () => {
  let directory: string;
  let logs: AndroidAppsLogService;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'rebroid-log-'));
    logs = new AndroidAppsLogService(
      new ConfigService({ app: { runtimeLogsDir: directory } }),
    );
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('keeps recent nonempty lines in order across an oversized multibyte log', async () => {
    await writeFile(
      join(directory, 'app.log'),
      `${'📝'.repeat(applicationLogMaxBytes)}\n\nthird\nsecond\nlast`,
    );
    await expect(logs.read('app', 2)).resolves.toBe('second\nlast');
    const clipped = await logs.read('app', 4);
    expect(clipped).toBe(
      '[Older log output omitted by the byte limit.]\nthird\nsecond\nlast',
    );
    expect(Buffer.byteLength(clipped)).toBeLessThan(applicationLogMaxBytes);
  });

  it('preserves empty and missing log behavior', async () => {
    await expect(logs.read('missing', 1)).resolves.toContain(
      'No orchestrator events',
    );
    await writeFile(join(directory, 'empty.log'), '');
    await expect(logs.read('empty', 1)).resolves.toBe('');
  });
});
