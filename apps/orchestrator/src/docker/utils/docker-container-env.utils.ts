const DEFAULT_TIMEZONE = 'UTC';

export const resolveHostTimezone = () => {
  const configuredTimezone = process.env.TZ?.trim();
  if (configuredTimezone) {
    return configuredTimezone;
  }

  try {
    const resolvedTimezone =
      Intl.DateTimeFormat().resolvedOptions().timeZone?.trim();
    return resolvedTimezone || DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
};

export const withHostTimezoneEnv = (env: string[]) => {
  if (env.some((entry) => entry.startsWith('TZ='))) {
    return env;
  }

  return [...env, `TZ=${resolveHostTimezone()}`];
};
