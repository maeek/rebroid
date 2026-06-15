import {
  resolveHostTimezone,
  withHostTimezoneEnv,
} from './docker-container-env.utils';

const dateTimeFormatWithTimezone = (timeZone: string | undefined) =>
  ({
    resolvedOptions: () => ({ timeZone }),
  }) as unknown as Intl.DateTimeFormat;

describe('docker container env utilities', () => {
  const originalTimezone = process.env.TZ;

  afterEach(() => {
    if (originalTimezone === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTimezone;
    }
    jest.restoreAllMocks();
  });

  it('uses the configured process timezone when present', () => {
    process.env.TZ = 'Europe/Warsaw';

    expect(resolveHostTimezone()).toBe('Europe/Warsaw');
  });

  it('falls back to the runtime resolved timezone', () => {
    delete process.env.TZ;
    jest
      .spyOn(Intl, 'DateTimeFormat')
      .mockReturnValue(dateTimeFormatWithTimezone('America/New_York'));

    expect(resolveHostTimezone()).toBe('America/New_York');
  });

  it('falls back to UTC when no host timezone can be resolved', () => {
    delete process.env.TZ;
    jest
      .spyOn(Intl, 'DateTimeFormat')
      .mockReturnValue(dateTimeFormatWithTimezone(undefined));

    expect(resolveHostTimezone()).toBe('UTC');
  });

  it('appends TZ without replacing existing environment variables', () => {
    process.env.TZ = 'Europe/Warsaw';

    expect(withHostTimezoneEnv(['PORT=3000'])).toEqual([
      'PORT=3000',
      'TZ=Europe/Warsaw',
    ]);
  });

  it('does not overwrite an existing TZ variable', () => {
    process.env.TZ = 'Europe/Warsaw';
    const env = ['TZ=UTC', 'PORT=3000'];

    expect(withHostTimezoneEnv(env)).toBe(env);
  });
});
