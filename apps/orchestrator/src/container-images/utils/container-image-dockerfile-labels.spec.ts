import {
  dockerfileWithRequiredLabels,
  requiredRuntimeImageLabels,
} from './container-image-dockerfile-labels';

const labels = requiredRuntimeImageLabels({
  runtimeKind: 'redroid',
  androidVersion: '14',
  architecture: 'amd64',
  gmsMode: 'microg',
  signatureSpoofing: 'external_required',
});

describe('container image Dockerfile labels', () => {
  it('appends the required Rebroid labels', () => {
    const dockerfile = dockerfileWithRequiredLabels(
      'FROM redroid/redroid:14',
      labels,
    );

    expect(dockerfile).toContain('com.rebroid.managed="true"');
    expect(dockerfile).toContain('com.rebroid.runtime.kind="redroid"');
    expect(dockerfile).toContain('com.rebroid.gms.mode="microg"');
  });

  it('rejects contradictory required labels', () => {
    expect(() =>
      dockerfileWithRequiredLabels(
        'FROM redroid/redroid:14\nLABEL com.rebroid.runtime.kind="generic"',
        labels,
      ),
    ).toThrow(/runtime\.kind/);
  });
});
