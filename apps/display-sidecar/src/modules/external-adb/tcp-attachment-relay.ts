import { createConnection, createServer, type Socket } from "node:net";

export async function openTcpAttachmentRelay(
  host: string,
  port: number,
  usedPorts: Set<number>,
  onLoss: () => void,
) {
  let downstream: Socket | undefined;
  let upstream: Socket | undefined;
  let closed = false;
  let retiring = false;
  const stop = () => {
    retiring = true;
    downstream?.destroy();
    upstream?.destroy();
  };
  const retire = () => {
    if (closed || retiring) return;
    stop();
    onLoss();
  };
  const close = () => {
    if (closed) return;
    closed = true;
    stop();
    listener.close();
  };
  const listener = createServer((socket) => {
    if (closed || retiring || downstream) {
      socket.destroy();
      return;
    }
    downstream = socket;
    upstream = createConnection({ host, port });
    for (const connection of [downstream, upstream]) {
      connection.once("error", retire);
      connection.once("close", retire);
    }
    const deadline = setTimeout(retire, 3_000);
    upstream.once("connect", () => clearTimeout(deadline));
    upstream.once("close", () => clearTimeout(deadline));
    downstream.pipe(upstream).pipe(downstream);
  });
  let localPort: number | undefined;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await new Promise<void>((resolve, reject) => {
      listener.once("error", reject);
      listener.listen(0, "127.0.0.1", () => {
        listener.off("error", reject);
        resolve();
      });
    });
    const address = listener.address();
    if (
      address &&
      typeof address !== "string" &&
      !usedPorts.has(address.port)
    ) {
      localPort = address.port;
      usedPorts.add(localPort);
      break;
    }
    // A late adb reconnect must never reach a different relay on the same port.
    await new Promise<void>((resolve) => listener.close(() => resolve()));
  }
  listener.on("error", retire);
  if (!localPort) throw new Error("ADB relay could not bind.");
  return { endpoint: `127.0.0.1:${localPort}`, stop, close };
}
