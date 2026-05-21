import {
  applyRedroidDefaultContainerArgs,
  redroidDefaultContainerArgs,
} from './redroid-runtime.utils';

describe('redroid-runtime utils', () => {
  it('applies only documented redroid default boot arguments', () => {
    expect(
      applyRedroidDefaultContainerArgs('redroid/redroid:14.0.0-latest'),
    ).toBe(redroidDefaultContainerArgs.join(' '));
    expect(redroidDefaultContainerArgs).toEqual([
      'androidboot.redroid_gpu_mode=guest',
      'androidboot.use_memfd=true',
      'ro.secure=0',
      'ro.debuggable=1',
      'androidboot.redroid_width=1080',
      'androidboot.redroid_height=2340',
      'androidboot.redroid_dpi=440',
      'androidboot.redroid_fps=60',
    ]);
  });

  it('preserves user-provided overrides without duplicating defaults', () => {
    expect(
      applyRedroidDefaultContainerArgs(
        'redroid/redroid:14.0.0-latest',
        'ro.secure=1 androidboot.redroid_width=1080',
      ),
    ).toBe(
      [
        'androidboot.redroid_gpu_mode=guest',
        'androidboot.use_memfd=true',
        'ro.debuggable=1',
        'androidboot.redroid_height=2340',
        'androidboot.redroid_dpi=440',
        'androidboot.redroid_fps=60',
        'ro.secure=1',
        'androidboot.redroid_width=1080',
      ].join(' '),
    );
  });

  it('leaves non-redroid images unchanged', () => {
    expect(
      applyRedroidDefaultContainerArgs('custom/android:latest'),
    ).toBeNull();
    expect(
      applyRedroidDefaultContainerArgs('custom/android:latest', 'foo=bar'),
    ).toBe('foo=bar');
  });
});
