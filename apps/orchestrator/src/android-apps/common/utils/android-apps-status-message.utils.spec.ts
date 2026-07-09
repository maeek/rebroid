import { AndroidApplication } from '../../android-application.entity';
import { AndroidApplicationStatus } from '../../contracts/android-application-status';
import {
  deriveApplicationError,
  errorStatusTitle,
} from './android-apps-error-status.utils';
import { containerExitedMessage } from './android-apps-status-message.utils';

describe('android apps status message utilities', () => {
  it('reports Docker OOM kills distinctly from generic exit code 137 failures', () => {
    expect(
      containerExitedMessage(
        { status: AndroidApplicationStatus.Running } as AndroidApplication,
        {
          exists: true,
          running: false,
          status: 'exited',
          exitCode: 137,
          oomKilled: true,
          error: null,
          finishedAt: '2026-05-31T17:11:31.000Z',
        },
      ),
    ).toBe(
      'Managed container exited with exit code 137. Docker reported that the container was OOM-killed.',
    );
  });

  it('exposes an actionable OOM-killed application error', () => {
    const app = {
      status: AndroidApplicationStatus.Error,
      lastError:
        'Managed container exited with exit code 137. Docker reported that the container was OOM-killed.',
      provisioningStartedAt: new Date('2026-05-31T17:00:00.000Z'),
      provisioningCompletedAt: new Date('2026-05-31T17:01:00.000Z'),
    } as AndroidApplication;

    app.applicationError = deriveApplicationError(app);

    expect(app.applicationError).toMatchObject({
      code: 'container_oom_killed',
      phase: 'runtime',
      retryable: true,
      exitCode: 137,
    });
    expect(errorStatusTitle(app)).toBe('App stopped due to memory pressure');
  });
});
