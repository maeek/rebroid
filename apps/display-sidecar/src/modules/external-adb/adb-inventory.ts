export interface AdbTransport {
  serial: string;
  state: string;
  id: string;
  usbPath?: string;
  model?: string;
}

export function parseAdbInventory(snapshot: string): AdbTransport[] {
  return snapshot.split("\n").flatMap((line) => {
    const [serial, state, ...fields] = line.trim().split(/\s+/);
    const id = fields
      .find((field) => /^transport_id:[1-9]\d*$/.test(field))
      ?.slice(13);
    if (!serial || !state || !id) return [];
    return [
      {
        serial,
        state,
        id,
        usbPath: fields.find((field) => /^usb:[\d.-]+$/.test(field))?.slice(4),
        model: fields
          .find((field) => /^model:[\w.-]{1,80}$/.test(field))
          ?.slice(6),
      },
    ];
  });
}
