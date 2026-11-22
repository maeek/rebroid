import { selectBestIconDataUrl } from './apk-icon-selection';

it('reads the highest scoring entries first and keeps archive order for tied candidates', async () => {
  const entries = Array.from({ length: 30 }, (_, i) => ({
    name: `res/mipmap/launcher-${i}.png`,
    uncompressedSize: 32,
  }));
  const preferred = {
    name: 'res/mipmap/launcher-round.png',
    uncompressedSize: 32,
  };
  const read = jest.fn(async (name: string) => Buffer.from(name));
  const result = await selectBestIconDataUrl([...entries, preferred], read);
  expect(read.mock.calls.flat()).toEqual([
    preferred.name,
    ...entries.slice(0, 23).map(({ name }) => name),
  ]);
  expect(result).toBe(
    `data:image/png;base64,${Buffer.from(preferred.name).toString('base64')}`,
  );
});

it('skips decompression when later images cannot beat the current icon', async () => {
  const best = 'res/mipmap/ic_launcher.png';
  const read = jest.fn(async () => Buffer.from('icon'));
  await selectBestIconDataUrl(
    [best, 'res/drawable/other.png'].map((name) => ({
      name,
      uncompressedSize: 128,
    })),
    read,
  );
  expect(read.mock.calls).toEqual([[best]]);
});
