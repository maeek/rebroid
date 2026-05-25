import { EventEmitter } from 'node:events';
import { Socket } from 'node:net';
import { ScrcpySocket } from './scrcpy.types';

const SOCKET_CONNECT_TIMEOUT_MS = 10_000;

const ADB_COMMAND = {
  AUTH: 0x48545541,
  CLSE: 0x45534c43,
  CNXN: 0x4e584e43,
  OKAY: 0x59414b4f,
  OPEN: 0x4e45504f,
  WRTE: 0x45545257,
} as const;

const ADB_VERSION = 0x01000000;
const ADB_MAX_PAYLOAD = 1024 * 1024;

interface DirectAdbReadMessage {
  payload: Buffer;
  remoteId: number;
}

export class DirectAdbConnection {
  private readonly transport = new Socket();
  private buffer = Buffer.alloc(0);
  private closed = false;
  private connected = false;
  private nextLocalId = Math.floor(Math.random() * 0x3fffffff) + 1;
  private readonly streams = new Map<number, DirectAdbSocket>();
  private readonly pendingStreams = new Map<number, DirectAdbSocket>();
  private openResolve: ((connection: DirectAdbConnection) => void) | null = null;
  private openReject: ((error: Error) => void) | null = null;

  constructor(private readonly debugLog: (message: string) => void = () => undefined) {}

  get destroyed() {
    return this.closed || this.transport.destroyed;
  }

  connect(host: string, port: number, timeoutMs = SOCKET_CONNECT_TIMEOUT_MS) {
    return new Promise<DirectAdbConnection>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.destroy();
        reject(new Error(`Timed out connecting direct ADB transport ${host}:${port}`));
      }, timeoutMs);

      this.openResolve = (connection) => {
        clearTimeout(timer);
        resolve(connection);
      };
      this.openReject = (error) => {
        clearTimeout(timer);
        reject(error);
      };

      this.transport.on('data', (chunk: Buffer) => this.handleTransportData(chunk));
      this.transport.once('connect', () => {
        this.transport.setNoDelay(true);
        this.debug('direct adb transport connected');
        this.sendPacket(ADB_COMMAND.CNXN, ADB_VERSION, ADB_MAX_PAYLOAD, Buffer.from('host::rebroid\0'));
      });
      this.transport.once('error', (error) => {
        this.debug(`direct adb transport failed: ${error.message}`);
        this.failOpen(error);
        this.closeStreams(error);
      });
      this.transport.once('close', () => {
        this.closed = true;
        this.debug(`direct adb transport closed; openStreams=${this.streams.size}; pendingStreams=${this.pendingStreams.size}`);
        const error = new Error('Direct ADB transport closed');
        this.failOpen(error);
        this.closeStreams(error);
      });
      this.transport.connect(port, host);
    });
  }

  setNoDelay(noDelay = true) {
    this.transport.setNoDelay(noDelay);
  }

  debug(message: string) {
    this.debugLog(message);
  }

  open(destination: string, label: string, timeoutMs = SOCKET_CONNECT_TIMEOUT_MS) {
    if (!this.connected || this.destroyed) {
      return Promise.reject(new Error(`Direct ADB transport is not connected for ${destination}`));
    }

    const socket = new DirectAdbSocket(this, destination, label, this.allocateLocalId());
    this.pendingStreams.set(socket.localId, socket);
    socket.once('close', () => {
      this.pendingStreams.delete(socket.localId);
      this.streams.delete(socket.localId);
    });
    this.sendPacket(ADB_COMMAND.OPEN, socket.localId, 0, Buffer.from(`${destination}\0`));
    const timer = setTimeout(() => {
      socket.destroy(new Error(`Timed out opening ADB local socket ${destination}`));
    }, timeoutMs);
    return socket.waitUntilOpen().finally(() => clearTimeout(timer));
  }

  closeStream(socket: DirectAdbSocket) {
    this.pendingStreams.delete(socket.localId);
    this.streams.delete(socket.localId);
  }

  sendPacket(command: number, arg0: number, arg1: number, payload: Uint8Array = Buffer.alloc(0)) {
    if (this.transport.destroyed) {
      return;
    }

    const data = Buffer.from(payload);
    const header = Buffer.alloc(24);
    header.writeUInt32LE(command, 0);
    header.writeUInt32LE(arg0, 4);
    header.writeUInt32LE(arg1, 8);
    header.writeUInt32LE(data.byteLength, 12);
    header.writeUInt32LE(this.checksum(data), 16);
    header.writeUInt32LE((command ^ 0xffffffff) >>> 0, 20);
    this.transport.write(data.byteLength ? Buffer.concat([header, data]) : header);
  }

  destroy(error?: Error) {
    if (this.closed) {
      return;
    }

    this.closed = true;
    this.closeStreams(error ?? new Error('Direct ADB transport closed'));
    this.transport.destroy(error);
  }

  private allocateLocalId() {
    const localId = this.nextLocalId;
    this.nextLocalId = this.nextLocalId >= 0x7fffffff ? 1 : this.nextLocalId + 1;
    return localId;
  }

  private handleTransportData(chunk: Buffer) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 24) {
      const length = this.buffer.readUInt32LE(12);
      if (this.buffer.length < 24 + length) {
        return;
      }

      const header = this.buffer.subarray(0, 24);
      const payload = this.buffer.subarray(24, 24 + length);
      this.buffer = this.buffer.subarray(24 + length);
      this.handlePacket(header.readUInt32LE(0), header.readUInt32LE(4), header.readUInt32LE(8), payload);
    }
  }

  private handlePacket(command: number, arg0: number, arg1: number, payload: Buffer) {
    if (command === ADB_COMMAND.AUTH) {
      const error = new Error('ADB authentication is required for direct scrcpy sockets');
      this.failOpen(error);
      this.destroy(error);
      return;
    }

    if (command === ADB_COMMAND.CNXN) {
      this.connected = true;
      this.debug('direct adb transport handshake completed');
      this.openResolve?.(this);
      this.openResolve = null;
      this.openReject = null;
      return;
    }

    if (command === ADB_COMMAND.OKAY) {
      const pending = this.pendingStreams.get(arg1);
      if (pending) {
        this.pendingStreams.delete(arg1);
        this.streams.set(arg1, pending);
        pending.setOpened(arg0);
        return;
      }

      this.streams.get(arg1)?.handleOkay();
      return;
    }

    if (command === ADB_COMMAND.WRTE) {
      this.streams.get(arg1)?.handleWrite(arg0, payload);
      return;
    }

    if (command === ADB_COMMAND.CLSE) {
      const socket = this.streams.get(arg1) ?? this.pendingStreams.get(arg1);
      socket?.handleRemoteClose();
    }
  }

  private checksum(payload: Uint8Array) {
    let checksum = 0;
    for (const byte of payload) {
      checksum = (checksum + byte) >>> 0;
    }
    return checksum;
  }

  private closeStreams(error: Error) {
    const sockets = [...this.pendingStreams.values(), ...this.streams.values()];
    this.pendingStreams.clear();
    this.streams.clear();
    for (const socket of sockets) {
      socket.handleTransportClose(error);
    }
  }

  private failOpen(error: Error) {
    if (!this.openResolve && !this.openReject) {
      return;
    }
    this.openReject?.(error);
    this.openResolve = null;
    this.openReject = null;
  }
}

class DirectAdbSocket extends EventEmitter implements ScrcpySocket {
  private remoteId = 0;
  private opened = false;
  private pendingWriteOk = false;
  private paused = false;
  private closed = false;
  private readonly readQueue: DirectAdbReadMessage[] = [];
  private readonly pendingReadAcks: number[] = [];
  private readonly writeQueue: Buffer[] = [];
  private openResolve: ((socket: DirectAdbSocket) => void) | null = null;
  private openReject: ((error: Error) => void) | null = null;

  get destroyed() {
    return this.closed || this.connection.destroyed;
  }

  get writable() {
    return this.opened && !this.destroyed;
  }

  constructor(
    private readonly connection: DirectAdbConnection,
    private readonly destination: string,
    private readonly label: string,
    readonly localId: number,
  ) {
    super();
  }

  waitUntilOpen() {
    return new Promise<DirectAdbSocket>((resolve, reject) => {
      this.openResolve = resolve;
      this.openReject = reject;
    });
  }

  setOpened(remoteId: number) {
    if (this.closed) {
      return;
    }

    this.remoteId = remoteId;
    this.opened = true;
    this.debug(`direct ${this.label} socket opened; localId=${this.localId}; remoteId=${this.remoteId}`);
    this.openResolve?.(this);
    this.openResolve = null;
    this.openReject = null;
  }

  handleOkay() {
    if (!this.opened || this.closed) {
      return;
    }

    this.pendingWriteOk = false;
    this.flushWrites();
  }

  handleWrite(remoteId: number, payload: Buffer) {
    if (!this.opened || this.closed) {
      return;
    }

    const message = {
      payload: Buffer.from(payload),
      remoteId,
    };
    if (this.paused) {
      this.readQueue.push(message);
    } else {
      this.emitReadable(message);
    }
  }

  handleRemoteClose() {
    if (this.opened || this.label !== 'video') {
      this.debug(
        `direct ${this.label} socket closed by device; opened=${this.opened}; localId=${this.localId}; remoteId=${this.remoteId}; queuedReads=${this.readQueue.length}; pendingReadAcks=${this.pendingReadAcks.length}; queuedWrites=${this.writeQueue.length}; pendingWrite=${this.pendingWriteOk}`,
      );
    }
    this.failOpen(new Error(`ADB local socket ${this.destination} closed before opening`));
    if (this.opened && this.remoteId && !this.destroyed) {
      this.connection.sendPacket(ADB_COMMAND.CLSE, this.localId, this.remoteId);
    }
    this.close();
  }

  handleTransportClose(error: Error) {
    this.failOpen(error);
    this.close(error);
  }

  setNoDelay(noDelay = true) {
    this.connection.setNoDelay(noDelay);
    return this;
  }

  pause() {
    this.paused = true;
    return this;
  }

  resume() {
    this.paused = false;
    this.flushReadable();
    return this;
  }

  write(payload: Buffer | Uint8Array | string) {
    const buffer = typeof payload === 'string' ? Buffer.from(payload) : Buffer.from(payload);
    this.writeQueue.push(buffer);
    this.flushWrites();
    return true;
  }

  destroy(error?: Error) {
    if (this.closed) {
      return this;
    }
    this.closed = true;
    if (error) {
      this.debug(`destroying direct ${this.label} socket: ${error.message}`);
    }
    if (this.opened && this.remoteId) {
      this.connection.sendPacket(ADB_COMMAND.CLSE, this.localId, this.remoteId);
    }
    this.connection.closeStream(this);
    this.failOpen(error ?? new Error(`ADB local socket ${this.destination} closed before opening`));
    if (error && this.listenerCount('error') > 0) {
      this.emit('error', error);
    }
    this.emit('close');
    return this;
  }

  private flushWrites() {
    if (!this.opened || this.pendingWriteOk || !this.writeQueue.length || this.destroyed) {
      return;
    }

    const payload = this.writeQueue.shift()!;
    this.pendingWriteOk = true;
    this.connection.sendPacket(ADB_COMMAND.WRTE, this.localId, this.remoteId, payload);
  }

  private flushReadable() {
    while (!this.paused && this.pendingReadAcks.length) {
      this.ackReadable(this.pendingReadAcks.shift()!);
    }

    while (!this.paused && this.readQueue.length) {
      this.emitReadable(this.readQueue.shift()!);
    }
  }

  private emitReadable(message: DirectAdbReadMessage) {
    this.emit('data', message.payload);

    if (this.destroyed) {
      return;
    }

    if (this.paused) {
      this.pendingReadAcks.push(message.remoteId);
      return;
    }

    this.ackReadable(message.remoteId);
  }

  private ackReadable(remoteId: number) {
    if (this.opened && !this.destroyed) {
      this.connection.sendPacket(ADB_COMMAND.OKAY, this.localId, remoteId);
    }
  }

  private failOpen(error: Error) {
    if (!this.openResolve && !this.openReject) {
      return;
    }
    this.openReject?.(error);
    this.openResolve = null;
    this.openReject = null;
  }

  private close(error?: Error) {
    if (this.closed) {
      return;
    }

    this.closed = true;
    this.connection.closeStream(this);
    if (error && this.listenerCount('error') > 0) {
      this.emit('error', error);
    }
    this.emit('close');
  }

  private debug(message: string) {
    this.connection.debug(message);
  }
}
