import { createConnection, createServer, type Socket } from "node:net";

// Debian adb treats this loopback address as remote and cannot start a daemon
// there. Ports are never reassigned while a command from this process can live.
export const attachmentAdbHost = "127.0.0.1";

export async function openAttachmentAdbClient(
  socketPath: string,
  usedPorts: Set<number>,
) {
  const clients = new Set<Socket>();
  const server = createServer((client) => {
    const upstream = createConnection(socketPath);
    for (const socket of [client, upstream]) clients.add(socket);
    const close = () => {
      client.destroy();
      upstream.destroy();
      clients.delete(client);
      clients.delete(upstream);
    };
    for (const socket of [client, upstream]) {
      socket.on("error", close);
      socket.once("close", close);
    }
    client.pipe(upstream).pipe(client);
  });
  for (let attempt = 0; attempt < 16; attempt += 1) {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, attachmentAdbHost, () => {
        server.off("error", reject);
        resolve();
      });
    });
    const address = server.address();
    if (
      address &&
      typeof address !== "string" &&
      !usedPorts.has(address.port)
    ) {
      usedPorts.add(address.port);
      return {
        port: address.port,
        close: () => {
          for (const client of clients) client.destroy();
          server.close();
        },
      };
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  throw new Error("Could not allocate an ADB client listener.");
}
