const bootEventTags = new Set([
  'boot_progress_start',
  'boot_progress_preload_start',
  'boot_progress_preload_end',
  'boot_progress_system_run',
  'boot_progress_pms_start',
  'boot_progress_pms_ready',
  'boot_progress_ams_ready',
  'boot_progress_enable_screen',
  'wm_boot_animation_done',
]);

const maxBootEvents = 32;

export function androidBootEventCommand(startedAtMs: number) {
  return [
    'timeout',
    '-k',
    '1s',
    '1s',
    'logcat',
    '-b',
    'events',
    '-d',
    '-v',
    'threadtime,epoch,usec',
    '-T',
    (startedAtMs / 1_000).toFixed(3),
    '-m',
    String(maxBootEvents),
    ...Array.from(bootEventTags, (tag) => `${tag}:V`),
    '*:S',
  ];
}

export function parseAndroidBootEvents(
  output: string,
  startedAtMs: number,
  readySampleSettledAtMs: number,
) {
  const events: { tag: string; offsetFromContainerStartMs: number }[] = [];
  for (const line of output.split(/\r?\n/)) {
    const match =
      /^\s*(\d{1,12}\.\d{3,9})\s+\d+\s+\d+\s+\w\s+(\w+)\s*:\s*\d+\s*$/.exec(
        line,
      );
    if (!match) continue;
    const [, timestamp, tag] = match;
    if (!bootEventTags.has(tag)) continue;
    const eventAtMs = Number(timestamp) * 1_000;
    if (eventAtMs <= startedAtMs || eventAtMs > readySampleSettledAtMs) {
      continue;
    }

    events.push({
      tag,
      offsetFromContainerStartMs: Math.round(eventAtMs - startedAtMs),
    });
    if (events.length === maxBootEvents) break;
  }
  return events;
}
