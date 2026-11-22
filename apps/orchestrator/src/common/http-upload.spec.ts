import { PassThrough, Readable } from 'node:stream';
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
    const existingErrorListener = jest.fn();
    request.on('error', existingErrorListener);
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
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(request.closed).toBe(true);
    expect(request.listeners('error')).toEqual([existingErrorListener]);
  },
);

it.each(['abort', 'close'])(
  'stops the file consumer on request %s',
  async (event) => {
    const input = new PassThrough();
    const request = Object.assign(input, {
      headers: { 'content-type': 'multipart/form-data; boundary=boundary' },
    });
    const consume = jest.fn((stream: Readable) => text(stream));
    const result = consumeSingleFileUpload({
      request,
      fieldName: 'file',
      maxBytes: 16,
      missingError: () => new Error('missing'),
      limitError: () => new Error('too large'),
      canceledError: () => new Error('canceled'),
      consume,
    });
    input.write(
      '--boundary\r\nContent-Disposition: form-data; name="file"; filename="test.txt"\r\n\r\npartial',
    );
    const file = consume.mock.calls[0][0];
    if (event === 'abort') request.emit('aborted');
    else request.destroy();
    await expect(result).rejects.toThrow('canceled');
    expect(file.destroyed).toBe(true);
    input.destroy();
  },
);

it('rejects a request that disconnected before upload preparation completed', () => {
  const request = Object.assign(new PassThrough(), {
    headers: { 'content-type': 'multipart/form-data; boundary=boundary' },
  });
  request.destroy();
  const consume = jest.fn();
  expect(() =>
    consumeSingleFileUpload({
      request,
      consume,
      fieldName: 'file',
      maxBytes: 16,
      missingError: () => new Error('missing'),
      limitError: () => new Error('too large'),
      canceledError: () => new Error('canceled'),
    }),
  ).toThrow('canceled');
  expect(consume).not.toHaveBeenCalled();
});
