import { AndroidApplicationLifecycleStage } from '../../contracts/android-application-status';
import {
  extractExitCode,
  isStartupCommandFinishedMessage,
  parseImagePullProgress,
} from './android-apps-status.utils';

describe('android apps status utilities', () => {
  it('extracts container exit codes from status messages', () => {
    expect(extractExitCode('Container command failed with exit code 137')).toBe(
      137,
    );
    expect(extractExitCode('No exit code present')).toBeNull();
  });

  it('detects startup messages that indicate a short-lived primary process', () => {
    expect(
      isStartupCommandFinishedMessage(
        'The configured container command completed immediately.',
      ),
    ).toBe(true);
    expect(
      isStartupCommandFinishedMessage(
        'Plain images such as ubuntu usually need a long-running command like "sleep infinity".',
      ),
    ).toBe(true);
    expect(
      isStartupCommandFinishedMessage('Container is running normally.'),
    ).toBe(false);
  });

  it('parses image pull progress when the lifecycle stage matches', () => {
    expect(
      parseImagePullProgress(
        'Downloading 50mb/100mb sha256:abc123',
        AndroidApplicationLifecycleStage.ImagePulling,
      ),
    ).toEqual({
      status: 'Downloading',
      current: '50 MB',
      total: '100 MB',
      layerId: 'sha256:abc123',
      percent: 50,
    });
  });

  it('returns null for non-pull stages or invalid progress messages', () => {
    expect(
      parseImagePullProgress(
        'Downloading 50mb/100mb sha256:abc123',
        AndroidApplicationLifecycleStage.AndroidBooting,
      ),
    ).toBeNull();
    expect(
      parseImagePullProgress(
        'unstructured status text',
        AndroidApplicationLifecycleStage.ImagePulling,
      ),
    ).toBeNull();
  });
});
