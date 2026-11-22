import { validateContainerImageBuildReference } from './container-image-reference';

describe('container image build reference validation', () => {
  it('accepts local tags, registry ports, and sha256 digests', () => {
    expect(
      validateContainerImageBuildReference(
        'local/redroid-microg:14',
        'Base image',
      ),
    ).toBe('local/redroid-microg:14');
    expect(
      validateContainerImageBuildReference(
        'localhost:5000/redroid/redroid:14',
        'Base image',
      ),
    ).toBe('localhost:5000/redroid/redroid:14');
    expect(
      validateContainerImageBuildReference(
        'registry.example.test/rebroid/base:14@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        'Base image',
      ),
    ).toBe(
      'registry.example.test/rebroid/base:14@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );
  });

  it('accepts a digest-pinned base but requires a writable target', () => {
    const image = 'local/base@sha256:' + 'a'.repeat(64);
    expect(validateContainerImageBuildReference(image, 'Base image')).toBe(
      image,
    );
    expect(() =>
      validateContainerImageBuildReference(image, 'Target image'),
    ).toThrow('writable tag');
    expect(
      validateContainerImageBuildReference(' local/target ', 'Target image'),
    ).toBe('local/target');
  });

  it('rejects traversal and malformed references', () => {
    expect(() =>
      validateContainerImageBuildReference('../redroid:14', 'Base image'),
    ).toThrow(/Base image/);
    expect(() =>
      validateContainerImageBuildReference(
        'registry//redroid:14',
        'Base image',
      ),
    ).toThrow(/Base image/);
  });
});
