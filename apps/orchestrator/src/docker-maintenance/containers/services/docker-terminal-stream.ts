import type { WebSocket } from '@fastify/websocket';
import { z } from 'zod';
import type { DockerContainerTerminal } from '../../../docker/contracts/docker-container-terminal.port';

export const terminalFrameLimit = 16 * 1024;
const outputWindow = 128 * 1024;
const inputWindow = 64 * 1024;
const control = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ack'), bytes: z.int().min(1).max(outputWindow) }),
  z.object({
    type: z.literal('resize'),
    cols: z.int().min(2).max(500),
    rows: z.int().min(1).max(300),
  }),
]);

export const streamDockerTerminal = async (
  socket: WebSocket,
  terminal: DockerContainerTerminal,
  signal: AbortSignal,
  onInput: () => void,
) => {
  const { stream } = terminal;
  let outstanding = 0;
  let credit: (() => void) | undefined;
  let stalled: NodeJS.Timeout | undefined;
  let sendPending: (() => void) | undefined;
  let resize: Promise<void> | undefined;
  let dimensions: { cols: number; rows: number } | undefined;
  const streamScope = new AbortController();
  const ioSignal = AbortSignal.any([signal, streamScope.signal]);
  const failure = () => streamScope.abort(new Error('Terminal stream failed.'));
  const flushResize = async () => {
    while (dimensions && !ioSignal.aborted) {
      const { cols, rows } = dimensions;
      dimensions = undefined;
      await terminal.resize(cols, rows);
    }
  };

  const onFrame = (data: Buffer | ArrayBuffer | Buffer[], binary: boolean) => {
    if (ioSignal.aborted) return;
    const frame = Buffer.isBuffer(data)
      ? data
      : Array.isArray(data)
        ? Buffer.concat(data)
        : Buffer.from(data);
    if (frame.length > terminalFrameLimit) return failure();
    if (binary) {
      if (!frame.length || stream.writableLength + frame.length > inputWindow)
        return failure();
      stream.write(frame, (error) => {
        if (error) failure();
      });
      onInput();
      return;
    }
    try {
      const message = control.parse(JSON.parse(frame.toString('utf8')));
      if (message.type === 'ack') {
        if (message.bytes > outstanding) return failure();
        outstanding -= message.bytes;
        if (outstanding === 0) {
          clearTimeout(stalled);
          stalled = undefined;
        } else stalled?.refresh();
        credit?.();
        return;
      }
      dimensions = message;
      resize ??= flushResize()
        .catch(failure)
        .finally(() => {
          resize = undefined;
        });
    } catch {
      failure();
    }
  };

  const abort = () => {
    credit?.();
    sendPending?.();
    stream.destroy();
  };
  ioSignal.addEventListener('abort', abort, { once: true });
  socket.on('message', onFrame);
  try {
    ioSignal.throwIfAborted();
    socket.send(JSON.stringify({ type: 'ready' }));
    for await (const chunk of stream.iterator({
      destroyOnReturn: false,
    }) as AsyncIterable<Buffer>) {
      for (
        let offset = 0;
        offset < chunk.length;
        offset += terminalFrameLimit
      ) {
        const frame = chunk.subarray(offset, offset + terminalFrameLimit);
        while (!ioSignal.aborted && outstanding + frame.length > outputWindow) {
          await new Promise<void>((resolve) => {
            credit = resolve;
          });
          credit = undefined;
        }
        ioSignal.throwIfAborted();
        outstanding += frame.length;
        stalled ??= setTimeout(failure, 15_000);
        await new Promise<void>((resolve, reject) => {
          sendPending = () => reject(ioSignal.reason);
          socket.send(frame, { binary: true }, (error) => {
            sendPending = undefined;
            if (error) reject(error);
            else resolve();
          });
        });
      }
    }
    ioSignal.throwIfAborted();
  } finally {
    clearTimeout(stalled);
    ioSignal.removeEventListener('abort', abort);
    socket.off('message', onFrame);
  }
};
