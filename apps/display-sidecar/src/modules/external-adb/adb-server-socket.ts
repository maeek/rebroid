import { createConnection } from "node:net";

// Using the private smart socket directly prevents the adb CLI from launching
// a replacement daemon after the selected server has exited.
export function requestAdb(
  socketPath: string,
  services: readonly string[],
  response: "length" | "stream" | "status",
): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = createConnection(socketPath);
    let buffer = Buffer.alloc(0);
    let index = 0;
    let reading = false;
    const deadline = setTimeout(
      () => finish(new Error("ADB request timed out.")),
      3_000,
    );
    const finish = (error?: Error, value = "") => {
      clearTimeout(deadline);
      socket.destroy();
      if (error) reject(error);
      else resolve(value);
    };
    const send = () => {
      const bytes = Buffer.from(services[index]);
      socket.write(
        Buffer.concat([
          Buffer.from(bytes.length.toString(16).padStart(4, "0")),
          bytes,
        ]),
      );
    };
    socket.once("connect", send);
    socket.once("error", () => finish(new Error("ADB server unavailable.")));
    socket.once("end", () => {
      if (reading && response === "stream")
        finish(undefined, buffer.toString());
      else finish(new Error("ADB server closed the request."));
    });
    socket.on("data", (part) => {
      buffer = Buffer.concat([buffer, part]);
      if (buffer.length > 65_536)
        return finish(new Error("ADB response exceeded its limit."));
      if (!reading) {
        if (buffer.length < 4) return;
        if (buffer.toString("ascii", 0, 4) !== "OKAY") {
          return finish(new Error("ADB rejected the request."));
        }
        buffer = buffer.subarray(4);
        index += 1;
        if (index < services.length) return send();
        reading = true;
      }
      if (response === "status" && buffer.length >= 4) {
        if (buffer.toString("ascii", 0, 4) === "OKAY") return finish();
        return finish(new Error("ADB rejected the operation."));
      }
      if (response !== "length" || buffer.length < 4) return;
      const header = buffer.toString("ascii", 0, 4);
      if (!/^[\da-f]{4}$/i.test(header))
        return finish(new Error("Invalid ADB response."));
      const length = Number.parseInt(header, 16);
      if (buffer.length >= length + 4)
        finish(undefined, buffer.toString("utf8", 4, 4 + length));
    });
  });
}
