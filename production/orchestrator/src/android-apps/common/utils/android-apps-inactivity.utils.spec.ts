import { latestRuntimeActivity } from './android-apps-inactivity.utils';

describe('latestRuntimeActivity', () => {
  it('uses the new start time when viewer activity belongs to an older run', () => {
    const previousViewerActivity = new Date('2026-05-31T18:58:14.201Z');
    const restartedAt = new Date('2026-05-31T19:16:10.038Z');

    expect(latestRuntimeActivity(previousViewerActivity, restartedAt)).toBe(
      restartedAt,
    );
  });

  it('uses viewer activity recorded after the current start', () => {
    const startedAt = new Date('2026-05-31T19:16:10.038Z');
    const viewerActivity = new Date('2026-05-31T19:16:59.238Z');

    expect(latestRuntimeActivity(viewerActivity, startedAt)).toBe(
      viewerActivity,
    );
  });
});
