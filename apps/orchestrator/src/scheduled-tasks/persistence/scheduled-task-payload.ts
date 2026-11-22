import { isRecord } from '../../common/object-record';

// A missing payload is valid. An unreadable one must never enable default cleanup settings.
export function readScheduledTaskPayload(json: string | null) {
  if (json === null) return null;
  try {
    const value: unknown = JSON.parse(json);
    if (value === null || isRecord(value)) return value;
  } catch {
    // Keep the task available to repair through the configuration API.
  }
  return undefined;
}

export function requireScheduledTaskPayload(json: string | null) {
  const payload = readScheduledTaskPayload(json);
  if (payload === undefined)
    throw new Error('Stored maintenance task payload is invalid.');
  return payload;
}
