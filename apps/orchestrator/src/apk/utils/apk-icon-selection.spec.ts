import { selectBestIconDataUrl } from './apk-icon-selection';

it('reads the highest scoring entries first and keeps archive order for tied candidates', async () => {
  const entries = Array.from({ length: 30 }, (_, i) => ({
    name: `res/mipmap/launcher-${i}.png`,
    uncompressedSize: 32,
  }));
  const preferred = {
    name: 'res/mipmap/ic_launcher.png',
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
