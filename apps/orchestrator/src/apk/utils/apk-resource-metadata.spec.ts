import { inflateRawSync } from 'node:zlib';
import { readApkResourceMetadata } from './apk-resource-metadata';

// Deflated resources.arsc fixture with a shared string pool and three packages
// supplying multiple density configurations for the same resource IDs.
const resources = inflateRawSync(
  Buffer.from(
    '7ZI9TsMwHMV/TqDpwMCUSlWGDMwNE2Jg6AGQQIILuI2BSs6HnBjYmLgFA8fgCIwcgSNwBEiKROUyWEwMeYPlp+fn' +
      '/5P9AvZ4iyAEBAmvQMQ3BBzzg+5MAhwBZ4AGHtdSHKencqF0ml6ZqkiNaiprliplMjGqyYpVXcg609KWyxtlZnV5' +
      'TRx3Sm7knVxolZnKlnkvTKedcCu1VU1my8bWdWValc/uC+26mkJq3bvG4wu7aFetVhAk4iOABwa4EMEBT+uvZQSc' +
      'bJ147tf9r10KHAJz4Ny5xjGFocNHDncM4Y7DI69sc+GRzWvWJg8cvutwvLK9e2XzmbXJvd41SMTl0PdfMfT9b33v' +
      'OvUioN7KNOA/d+oT',
    'base64',
  ),
);

it('resolves the package label and ranks declared icon configurations together', () => {
  expect(readApkResourceMetadata(resources, 0x7f010003, [0x7f010001])).toEqual({
    label: ' Label  from resource ',
    icons: [
      { entryName: 'res/drawable/small.png', score: 5480 },
      { entryName: 'res/drawable/round.png', score: 5210 },
      { entryName: 'res/drawable/round.png', score: 5210 },
    ],
  });
});
