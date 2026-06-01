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

  it('rejects invalid WebRTC UDP ranges', () => {
    const previous = process.env.DISPLAY_WEBRTC_UDP_PORT_RANGE;
    process.env.DISPLAY_WEBRTC_UDP_PORT_RANGE = '40100-40000';

    expect(() => load()).toThrow();

    if (previous === undefined) {
      delete process.env.DISPLAY_WEBRTC_UDP_PORT_RANGE;
    } else {
      process.env.DISPLAY_WEBRTC_UDP_PORT_RANGE = previous;
    }
  });
});
