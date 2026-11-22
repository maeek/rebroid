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

// The first DEX contains a match straddling byte 16384. Two entries share a partial match.
const dexFixture = Buffer.from(
  'UEsDBBQAAAAIAAAAIQDS0S/+NwAAABFAAAALAAAAY2xhc3Nlcy5kZXjtwcEJgDAQALCJOlRBCwU5D71Cx3cMP0n2BgAAAAAAAAAA' +
    'AAAAAAAAAP417hVHy151PvHmNat9UEsDBBQAAAAIAAAAIQAE1aBSFgAAABQAAAAMAAAAY2xhc3NlczIuZGV4S0wuyi8uzi/JSC3S' +
    'TS3LTEnNS04FAFBLAwQUAAAACAAAACEATkHU1gkAAAAHAAAACQAAAG90aGVyLnR4dMtMz8svSk0BAFBLAQIUAxQAAAAIAAAAIQDS' +
    '0S/+NwAAABFAAAALAAAAAAAAAAAAAACAAQAAAABjbGFzc2VzLmRleFBLAQIUAxQAAAAIAAAAIQAE1aBSFgAAABQAAAAMAAAAAAAA' +
    'AAAAAACAAWAAAABjbGFzc2VzMi5kZXhQSwECFAMUAAAACAAAACEATkHU1gkAAAAHAAAACQAAAAAAAAAAAAAAgAGgAAAAb3RoZXIu' +
    'dHh0UEsFBgAAAAADAAMAqgAAANAAAAAAAA==',
  'base64',
);

describe('ApkArchiveService', () => {
  it('indexes once, reads the first duplicate, bounds reads, and closes the archive', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'rebroid-apk-test-'));
    const apk = join(directory, 'fixture.apk');
    const open = jest.spyOn(yauzl, 'openPromise');
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
          await expect(readEntry('entry.txt', 4, 'skip')).resolves.toBeNull();
          await expect(readEntry('entry.txt', 5, 'skip')).resolves.toEqual(
            Buffer.from('first'),
          );
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
  it('scans streamed entries within a cumulative limit and never joins evidence across files', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'rebroid-apk-test-'));
    const apk = join(directory, 'fixture.apk');
    const service = new ApkArchiveService();
    try {
      await writeFile(apk, dexFixture);
      const scan = (limit: number) =>
        service.scanAsciiPatterns(
          apk,
          /^classes\d*\.dex$/,
          ['found-pattern', 'other-evidence', 'split-across', 'ignored'],
          limit,
        );
      const total = 16382 + 'found-patternsplit-acrossother-evidence'.length;
      await expect(scan(total)).resolves.toEqual(
        new Set(['found-pattern', 'other-evidence']),
      );
      await expect(scan(total - 1)).rejects.toThrow('DEX scan limit exceeded');
      await expect(service.readEntry(apk, 'classes2.dex', 20)).resolves.toEqual(
        Buffer.from('acrossother-evidence'),
      );
      await expect(
        service.readEntry(apk, 'missing.dex', 0),
      ).resolves.toBeNull();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
