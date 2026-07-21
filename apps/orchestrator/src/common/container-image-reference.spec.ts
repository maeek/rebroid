import { resolveContainerImage } from './container-image-reference';

describe('resolveContainerImage', () => {
  it('leaves images with explicit registry untouched', () => {
    expect(
      resolveContainerImage('localhost:5000/app:1', 'registry.internal'),
    ).toBe('localhost:5000/app:1');
    expect(
      resolveContainerImage('example.com/org/app', 'registry.internal'),
    ).toBe('example.com/org/app');
  });

  it('prepends registry for relative images', () => {
    expect(
      resolveContainerImage('redroid/redroid:14', 'registry.internal'),
    ).toBe('registry.internal/redroid/redroid:14');
  });

  it('normalizes registry prefixes and leaves names untouched when no registry configured', () => {
    expect(resolveContainerImage(' app-image:1 ', null)).toBe('app-image:1');
    expect(resolveContainerImage('app-image:1', '  ')).toBe('app-image:1');
  });

  it('does not prepend to images already containing a registry host', () => {
    expect(
      resolveContainerImage(
        ' ghcr.io/redroid/redroid:14 ',
        'registry.internal',
      ),
    ).toBe('ghcr.io/redroid/redroid:14');
    expect(
      resolveContainerImage(' localhost/redroid:1 ', 'registry.internal'),
    ).toBe('localhost/redroid:1');
  });
});
