import { InactivityService } from './inactivity.service';

it('continues the inactivity sweep when a candidate fails to stop', async () => {
  const candidates = Array.from({ length: 6 }, (_, id) => ({ id: String(id) }));
  const stopIfInactive = jest
    .fn()
    .mockRejectedValueOnce(new Error('stop failed'));
  const sweep = new InactivityService(
    {
      findInactiveRunningApplications: () => Promise.resolve(candidates),
    } as never,
    { stopIfInactive } as never,
  );
  await sweep.stopInactiveApplications();
  expect(stopIfInactive.mock.calls.map(([candidate]) => candidate)).toEqual(
    candidates,
  );
});
