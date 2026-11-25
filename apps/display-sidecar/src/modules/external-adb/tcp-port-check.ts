import { createConnection } from "node:net";
import type { ExternalAdbTcpCheckStatus } from "@rebroid/android-application-core/android-device";

export function checkTcpPort(
  host: string,
  port: number,
): Promise<ExternalAdbTcpCheckStatus> {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    const finish = (status: ExternalAdbTcpCheckStatus) => {
      clearTimeout(deadline);
      socket.destroy();
      resolve(status);
    };
    const deadline = setTimeout(() => finish("timed_out"), 2_000);
    socket.once("connect", () => finish("reachable"));
    socket.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ECONNREFUSED") return finish("refused");
      if (error.code === "ETIMEDOUT") return finish("timed_out");
      finish("unreachable");
    });
  });
}
