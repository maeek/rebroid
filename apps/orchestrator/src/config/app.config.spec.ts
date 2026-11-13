import appConfig from './app.config';

describe('appConfig', () => {
  const load = appConfig as unknown as () => unknown;

  it('rejects invalid Docker read concurrency', () => {
    const previous = process.env.DOCKER_MAX_CONCURRENT_READS;
    process.env.DOCKER_MAX_CONCURRENT_READS = '0';

    expect(() => load()).toThrow();

    if (previous === undefined) {
      delete process.env.DOCKER_MAX_CONCURRENT_READS;
    } else {
      process.env.DOCKER_MAX_CONCURRENT_READS = previous;
    }
  });

  it('rejects invalid lifecycle job concurrency', () => {
    const previous = process.env.MAX_CONCURRENT_LIFECYCLE_JOBS;
    process.env.MAX_CONCURRENT_LIFECYCLE_JOBS = '0';

    expect(() => load()).toThrow();

    if (previous === undefined) {
      delete process.env.MAX_CONCURRENT_LIFECYCLE_JOBS;
    } else {
      process.env.MAX_CONCURRENT_LIFECYCLE_JOBS = previous;
    }
  });

  it('rejects invalid long Docker operation concurrency', () => {
    const previous = process.env.DOCKER_MAX_CONCURRENT_LONG_OPERATIONS;
    process.env.DOCKER_MAX_CONCURRENT_LONG_OPERATIONS = '0';

    expect(() => load()).toThrow();

    if (previous === undefined) {
      delete process.env.DOCKER_MAX_CONCURRENT_LONG_OPERATIONS;
    } else {
      process.env.DOCKER_MAX_CONCURRENT_LONG_OPERATIONS = previous;
    }
  });

  it('rejects invalid WebRTC UDP ports', () => {
    const previous = process.env.DISPLAY_WEBRTC_UDP_PORT;
    process.env.DISPLAY_WEBRTC_UDP_PORT = '65536';

    expect(() => load()).toThrow();

    if (previous === undefined) {
      delete process.env.DISPLAY_WEBRTC_UDP_PORT;
    } else {
      process.env.DISPLAY_WEBRTC_UDP_PORT = previous;
    }
  });

  it('leaves Android boot event collection off unless explicitly enabled', () => {
    const previous = process.env.REDROID_COLLECT_BOOT_EVENTS;
    try {
      delete process.env.REDROID_COLLECT_BOOT_EVENTS;
      expect(load()).toMatchObject({ redroid: { collectBootEvents: false } });
      process.env.REDROID_COLLECT_BOOT_EVENTS = 'true';
      expect(load()).toMatchObject({ redroid: { collectBootEvents: true } });
      process.env.REDROID_COLLECT_BOOT_EVENTS = 'yes';
      expect(() => load()).toThrow();
    } finally {
      if (previous === undefined) delete process.env.REDROID_COLLECT_BOOT_EVENTS;
      else process.env.REDROID_COLLECT_BOOT_EVENTS = previous;
    }
  });
});
