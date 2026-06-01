import {
  formatContainerCommandFailureMessage,
  hasDockerStatusCode,
} from './docker-engine.utils';

describe('docker engine utilities', () => {
  it('matches docker API style status codes on thrown objects', () => {
    expect(hasDockerStatusCode({ statusCode: 404 }, 404)).toBe(true);
    expect(hasDockerStatusCode({ statusCode: 500 }, 404)).toBe(false);
    expect(hasDockerStatusCode(new Error('boom'), 404)).toBe(false);
  });

  it('formats container command failure messages with combined output', () => {
    expect(
      formatContainerCommandFailureMessage({
        command: ['pm', 'install', '-r', '/tmp/app.apk'],
        exitCode: 1,
        stdout: 'stdout info',
        stderr: 'stderr info',
      }),
    ).toBe(
      'Container command failed with exit code 1: pm install -r /tmp/app.apk stderr info stdout info',
    );
  });

  it('formats container command failure messages without trailing detail', () => {
    expect(
      formatContainerCommandFailureMessage({
        command: ['sleep', '1'],
        exitCode: 137,
        stdout: '   ',
        stderr: '',
      }),
    ).toBe('Container command failed with exit code 137: sleep 1');
  });
});
