import { ConflictException } from '@nestjs/common';

const registrySegmentPattern = '[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?';
const pathSegmentPattern = '[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?';
const tagPattern = '[A-Za-z0-9_][A-Za-z0-9._-]{0,127}';
const digestPattern = 'sha256:[A-Fa-f0-9]{64}';
const imageReferencePattern = new RegExp(
  `^${registrySegmentPattern}(?::[0-9]+)?(?:/${pathSegmentPattern})*(?::${tagPattern})?(?:@${digestPattern})?$`,
);

export const validateContainerImageBuildReference = (
  image: string,
  label: string,
) => {
  const trimmed = image.trim();
  if (
    !imageReferencePattern.test(trimmed) ||
    trimmed.includes('..') ||
    trimmed.includes('//')
  ) {
    throw new ConflictException(`${label} is not a supported image reference.`);
  }
  return trimmed;
};
