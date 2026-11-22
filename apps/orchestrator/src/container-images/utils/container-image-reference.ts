import { ConflictException } from '@nestjs/common';

const segmentPattern = '[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?';
const tagPattern = '[A-Za-z0-9_][A-Za-z0-9._-]{0,127}';
const digestPattern = 'sha256:[A-Fa-f0-9]{64}';
const imageReferencePattern = new RegExp(
  `^${segmentPattern}(?::[0-9]+)?(?:/${segmentPattern})*(?::${tagPattern})?(?:@${digestPattern})?$`,
);

export const validateContainerImageBuildReference = (
  image: string,
  label: 'Base image' | 'Target image',
) => {
  const trimmed = image.trim();
  if (!imageReferencePattern.test(trimmed) || trimmed.includes('..')) {
    throw new ConflictException(`${label} is not a supported image reference.`);
  }
  if (label === 'Target image' && trimmed.includes('@')) {
    throw new ConflictException('Target image must use a writable tag.');
  }
  return trimmed;
};
