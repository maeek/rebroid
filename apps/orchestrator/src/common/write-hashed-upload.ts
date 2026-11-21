import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { type Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export async function writeHashedUpload(
  stream: Readable,
  path: string,
  maxBytes: number,
  limitError: () => Error,
) {
  const hash = createHash('sha256');
  let sizeBytes = 0;
  const counter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      sizeBytes += chunk.length;
      if (sizeBytes > maxBytes) {
        callback(limitError());
        return;
      }
      hash.update(chunk);
      callback(null, chunk);
    },
  });

  await pipeline(stream, counter, createWriteStream(path, { flags: 'wx' }));
  return { sha256: hash.digest('hex'), sizeBytes };
}
