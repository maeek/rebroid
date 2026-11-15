import { readFile, stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { RuntimeUploadStreamService } from './runtime-upload-stream.service';

it.each([false, true])(
  'stages a private, counted upload and cleans up after a store callback (failure=%s)',
  async (failStore) => {
    const uploads = new RuntimeUploadStreamService();
    let staged = '';
    const store = uploads.withStagedFile(
      Readable.from([Buffer.from('file'), Buffer.from(' contents')]),
      async (path) => {
        staged = path;
        expect(await readFile(path, 'utf8')).toBe('file contents');
        expect((await stat(path)).mode & 0o777).toBe(0o600);
        if (failStore) throw new Error('Archive write failed');
      },
    );
    if (failStore) await expect(store).rejects.toThrow('Archive write failed');
    else await expect(store).resolves.toBe(13);
    await expect(stat(staged)).rejects.toMatchObject({ code: 'ENOENT' });
  },
);
