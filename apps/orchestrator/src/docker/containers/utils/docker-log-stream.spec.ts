import { decodeDockerLogStream } from './docker-log-stream';

const frame = (type: number, payload: Buffer) => {
  const header = Buffer.alloc(8);
  header[0] = type;
  header.writeUInt32BE(payload.length, 4);
  return Buffer.concat([header, payload]);
};

describe('decodeDockerLogStream', () => {
  it('preserves the order and UTF-8 content of stdout and stderr frames', () => {
    const character = Buffer.from('🚀');
    expect(
      decodeDockerLogStream(
        Buffer.concat([
          frame(
            1,
            Buffer.concat([Buffer.from('started '), character.subarray(0, 2)]),
          ),
          frame(1, Buffer.concat([character.subarray(2), Buffer.from('\n')])),
          frame(2, Buffer.from('warning\n')),
        ]),
      ),
    ).toBe('started 🚀\nwarning\n');
  });

  it('keeps plain-text logs readable', () => {
    expect(decodeDockerLogStream(Buffer.from('started\n'))).toBe('started\n');
  });

  it('rejects a truncated frame without printing its binary header', () => {
    expect(() =>
      decodeDockerLogStream(frame(1, Buffer.from('test')).subarray(0, 10)),
    ).toThrow('Incomplete container log frame.');
  });
});
