import { Readable } from 'node:stream';
import { text } from 'node:stream/consumers';
import {
  consumeSingleFileUpload,
  type MultipartUploadRequest,
} from './http-upload';

it.each(['123', '1234', '12345'])(
  'enforces an inclusive four-byte upload limit for %s',
  async (contents) => {
    const request = Readable.from([
      '--boundary\r\nContent-Disposition: form-data; name="file"; filename="test.txt"\r\n\r\n',
      contents,
      '\r\n--boundary--\r\n',
    ]) as MultipartUploadRequest;
    request.headers = {
      'content-type': 'multipart/form-data; boundary=boundary',
    };
    const result = consumeSingleFileUpload({
      request,
      fieldName: 'file',
      maxBytes: 4,
      missingError: () => new Error('missing'),
      limitError: () => new Error('too large'),
      canceledError: () => new Error('canceled'),
      consume: (stream) => text(stream),
    });
    if (contents.length > 4) await expect(result).rejects.toThrow('too large');
    else await expect(result).resolves.toBe(contents);
  },
);
