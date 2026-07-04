import { validateContainerImageBuildReference } from './container-image-reference';

describe('container image build reference validation', () => {
  it('accepts local tags, registry ports, and sha256 digests', () => {
    expect(
      validateContainerImageBuildReference('local/redroid-microg:14', 'Image'),
    ).toBe('local/redroid-microg:14');
    expect(
      validateContainerImageBuildReference(
        'localhost:5000/redroid/redroid:14',
        'Image',
      ),
    ).toBe('localhost:5000/redroid/redroid:14');
    expect(
      validateContainerImageBuildReference(
        'registry.example.test/rebroid/base:14@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        'Image',
      ),
    ).toBe(
      'registry.example.test/rebroid/base:14@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );
  });

  it('rejects traversal and malformed references', () => {
    expect(() =>
      validateContainerImageBuildReference('../redroid:14', 'Image'),
    ).toThrow(/Image/);
    expect(() =>
      validateContainerImageBuildReference('registry//redroid:14', 'Image'),
    ).toThrow(/Image/);
  });
});
