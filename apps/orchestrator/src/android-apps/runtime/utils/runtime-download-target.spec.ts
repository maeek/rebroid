import { AndroidApplicationStatus } from '../../contracts/android-application-status';
import { ApplicationProfileMode } from '../../contracts/application-profile-mode';
import { runtimeDownloadTarget } from './runtime-download-target';

const running = {
  profileMode: ApplicationProfileMode.Persistent,
  profileName: ' Work ',
  status: AndroidApplicationStatus.Running,
  containerId: 'container-1',
};

it('routes the stored spelling to the active container and an explicit alias to its volume', () => {
  expect(runtimeDownloadTarget(running, {})).toEqual({
    kind: 'container',
    containerId: 'container-1',
  });
  expect(runtimeDownloadTarget(running, { profileName: ' Work ' })).toEqual({
    kind: 'volume',
    profileName: 'Work',
  });
});

it('allows temporary downloads only while their selected container is running', () => {
  const temporary = {
    ...running,
    profileMode: ApplicationProfileMode.Temporary,
  };
  expect(runtimeDownloadTarget(temporary, {})).toEqual({
    kind: 'container',
    containerId: 'container-1',
  });
  for (const unavailable of [
    { ...temporary, containerId: null },
    { ...temporary, status: AndroidApplicationStatus.Stopped },
  ]) {
    expect(runtimeDownloadTarget(unavailable, {})).toEqual({
      kind: 'volume',
      profileName: null,
    });
  }
});
