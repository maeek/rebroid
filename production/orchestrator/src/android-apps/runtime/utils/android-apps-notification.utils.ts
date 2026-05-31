const normalizeNotificationValue = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const normalized = value
    .trim()
    .replace(/^"+|"+$/g, '')
    .replace(/^(?:String|CharSequence)\s*\((.*)\)$/i, '$1')
    .replace(/\\n/g, ' ')
    .replace(/\s+/g, ' ');

  if (
    !normalized ||
    normalized === 'null' ||
    normalized === '[]' ||
    normalized === '0' ||
    /^(?:CONTENT_TYPE_|USAGE_)[A-Z_]+(?:\s|$)/.test(normalized) ||
    normalized.length > 300
  ) {
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
  if (!/(NotificationRecord|StatusBarNotification)/.test(raw)) {
    return null;
  }

  const packageName =
    extractNotificationValue(raw, [
      /(?:^|[\s(])pkg=([^\s,)]+)/m,
      /(?:^|[\s(])package=([^\s,)]+)/m,
    ]) ?? 'android';
  const title = extractNotificationValue(raw, [
    /android\.title=String \((.*?)\)/m,
    /^\s*android\.title=(.+)$/m,
    /(?:^|\s)title=([^,\n]+)/,
    /^\s*title=(.+)$/m,
    /(?:^|\s)tickerText=([^,\n]+)/,
    /^\s*tickerText=(.+)$/m,
  ]);
  const text = extractNotificationValue(raw, [
    /android\.bigText=String \((.*?)\)/m,
    /android\.text=String \((.*?)\)/m,
    /^\s*android\.bigText=(.+)$/m,
    /^\s*android\.text=(.+)$/m,
    /(?:^|\s)text=([^,\n]+)/,
    /^\s*text=(.+)$/m,
    /(?:^|\s)contentText=([^,\n]+)/,
    /^\s*contentText=(.+)$/m,
    /(?:^|\s)tickerText=([^,\n]+)/,
    /^\s*tickerText=(.+)$/m,
  ]);

  if (!title && !text) {
    return null;
  }

  return {
    packageName,
    title: title ?? packageName,
    text: text ?? title ?? packageName,
    appName: null,
    raw,
  };
};

export const parseAndroidNotifications = (output: string) => {
  const blocks = splitNotificationBlocks(output);
  const parsed = blocks
    .map(parseNotificationBlock)
    .filter(
      (
        notification,
      ): notification is NonNullable<
        ReturnType<typeof parseNotificationBlock>
      > =>
        notification !== null &&
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
