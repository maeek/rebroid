export type LiveControlChannel = RTCDataChannel | WebSocket;

export function selectLiveControlChannel(
  reliableChannel: RTCDataChannel | null,
  authorizedSocket: WebSocket | null,
): LiveControlChannel | null {
  if (reliableChannel?.readyState === "open") return reliableChannel;
  if (authorizedSocket?.readyState === WebSocket.OPEN) return authorizedSocket;
  return null;
}

export async function dispatchDiscreteControl(
  reliableChannel: RTCDataChannel | null,
  connectWebSocket: () => {
    socket: WebSocket | null;
    ready: boolean | Promise<boolean> | null;
  },
  waitMs: number,
  signal: AbortSignal,
  dispatch: (channel: LiveControlChannel) => Promise<void>,
  fallback: () => Promise<void>,
): Promise<void> {
  if (
    reliableChannel &&
    (await waitForOpen(reliableChannel, "open", waitMs, signal))
  ) {
    signal.throwIfAborted();
    return dispatch(reliableChannel);
  }
  signal.throwIfAborted();
  const { socket, ready } = connectWebSocket();
  if (
    socket &&
    (ready === true || (await ready)) &&
    socket.readyState === WebSocket.OPEN
  ) {
    signal.throwIfAborted();
    return dispatch(socket);
  }
  signal.throwIfAborted();
  return fallback();
}

function waitForOpen(
  channel: EventTarget & { readyState: string | number },
  open: string | number,
  waitMs: number,
  signal: AbortSignal,
): Promise<boolean> {
  if (channel.readyState === open) return Promise.resolve(true);
  if (
    channel.readyState !== "connecting" &&
    channel.readyState !== WebSocket.CONNECTING
  ) {
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    const finish = () => {
      window.clearTimeout(timer);
      channel.removeEventListener("open", finish);
      channel.removeEventListener("close", finish);
      channel.removeEventListener("error", finish);
      signal.removeEventListener("abort", finish);
      resolve(channel.readyState === open);
    };
    const timer = window.setTimeout(finish, waitMs);
    channel.addEventListener("open", finish);
    channel.addEventListener("close", finish);
    channel.addEventListener("error", finish);
    signal.addEventListener("abort", finish, { once: true });
  });
}
