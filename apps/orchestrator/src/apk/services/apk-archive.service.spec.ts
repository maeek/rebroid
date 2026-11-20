import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import yauzl from 'yauzl';
import { ApkArchiveService } from './apk-archive.service';

// Deflated ZIP with two entries named entry.txt, followed by other.txt.
const archiveFixture = Buffer.from(
  'UEsDBBQAAAAIAAAAIQBX7nGSBwAAAAUAAAAJAAAAZW50cnkudHh0S8ssKi4BAFBLAwQUAAAACAAAACEAaREftggAAA' +
    'AGAAAACQAAAGVudHJ5LnR4dCtOTc7PSwEAUEsDBBQAAAAIAAAAIQAgNVjZBwAAAAUAAAAJAAAAb3RoZXIudHh0yy/J' +
    'SC0CAFBLAQIUAxQAAAAIAAAAIQBX7nGSBwAAAAUAAAAJAAAAAAAAAAAAAACAAQAAAABlbnRyeS50eHRQSwECFAMUAA' +
    'AACAAAACEAaREftggAAAAGAAAACQAAAAAAAAAAAAAAgAEuAAAAZW50cnkudHh0UEsBAhQDFAAAAAgAAAAhACA1WNkH' +
    'AAAABQAAAAkAAAAAAAAAAAAAAIABXQAAAG90aGVyLnR4dFBLBQYAAAAAAwADAKUAAACLAAAAAAA=',
  'base64',
);

describe('ApkArchiveService', () => {
  it('indexes once, reads the first duplicate, bounds reads, and closes the archive', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'rebroid-apk-test-'));
    const apk = join(directory, 'fixture.apk');
    const open = jest.spyOn(yauzl, 'open');
    const close = jest.spyOn(yauzl.ZipFile.prototype, 'close');
    try {
      await writeFile(apk, archiveFixture);
      await new ApkArchiveService().withEntries(
        apk,
        async ({ entries, readEntry }) => {
          expect(entries.map(({ name }) => name)).toEqual([
            'entry.txt',
            'entry.txt',
            'other.txt',
          ]);
          await expect(readEntry('entry.txt', 5)).resolves.toEqual(
            Buffer.from('first'),
          );
          await expect(readEntry('other.txt', 5)).resolves.toEqual(
            Buffer.from('other'),
          );
          await expect(readEntry('missing.txt', 5)).resolves.toBeNull();
          await expect(readEntry('entry.txt', 4)).rejects.toThrow('too large');
        },
      );
      expect(open).toHaveBeenCalledTimes(1);
      expect(close).toHaveBeenCalledTimes(1);
    } finally {
      open.mockRestore();
      close.mockRestore();
      await rm(directory, { recursive: true, force: true });
    }
  });
});
