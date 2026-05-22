const normalizeNotificationValue = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const normalized = value
    .trim()
    .replace(/^"+|"+$/g, '')
    .replace(/\\n/g, ' ')
    .replace(/\s+/g, ' ');

  if (!normalized || normalized === 'null' || normalized === '[]') {
    return null;
  }

  return normalized;
};

const extractNotificationValue = (block: string, patterns: RegExp[]) => {
  for (const pattern of patterns) {
    const value = normalizeNotificationValue(block.match(pattern)?.[1]);
    if (value) {
      return value;
    }
  }

  return null;
};

const splitNotificationBlocks = (output: string) => {
  const lines = output.split('\n').map((line) => line.trimEnd());
  const blocks: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    if (/^(NotificationRecord|StatusBarNotification)\(/.test(trimmed)) {
      if (current.length > 0) {
        blocks.push(current.join('\n'));
      }
      current = [trimmed];
      continue;
    }

    if (current.length > 0) {
      current.push(trimmed);
    }
  }

  if (current.length > 0) {
    blocks.push(current.join('\n'));
  }

  return blocks;
};

const parseNotificationBlock = (raw: string) => {
  const packageName =
    extractNotificationValue(raw, [
      /(?:^|[\s\(])pkg=([^\s,\)]+)/m,
      /(?:^|[\s\(])package=([^\s,\)]+)/m,
    ]) ?? 'android';
  const title =
    extractNotificationValue(raw, [
      /^\s*android\.title=(.+)$/m,
      /(?:^|\s)title=([^,\n]+)/,
      /^\s*title=(.+)$/m,
      /(?:^|\s)tickerText=([^,\n]+)/,
      /^\s*tickerText=(.+)$/m,
    ]) ?? packageName;
  const text =
    extractNotificationValue(raw, [
      /^\s*android\.bigText=(.+)$/m,
      /^\s*android\.text=(.+)$/m,
      /(?:^|\s)text=([^,\n]+)/,
      /^\s*text=(.+)$/m,
      /(?:^|\s)content(?:Text)?=([^,\n]+)/,
      /^\s*content(?:Text)?=(.+)$/m,
      /(?:^|\s)tickerText=([^,\n]+)/,
      /^\s*tickerText=(.+)$/m,
    ]) ??
    normalizeNotificationValue(raw.split('\n')[0]) ??
    raw;

  return { packageName, title, text, raw };
};

const parseSingleLineNotifications = (output: string) => {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => /Notification|pkg=|package=/i.test(line))
    .map(parseNotificationBlock);
};

export const parseAndroidNotifications = (output: string) => {
  const blocks = splitNotificationBlocks(output);
  const parsed = (
    blocks.length > 0
      ? blocks.map(parseNotificationBlock)
      : parseSingleLineNotifications(output)
  ).filter(
    (notification) =>
      Boolean(notification.packageName) &&
      Boolean(notification.title) &&
      Boolean(notification.text),
  );

  const seen = new Set<string>();

  return parsed
    .filter((notification) => {
      const key = `${notification.packageName}|${notification.title}|${notification.text}`;
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, 30);
};
