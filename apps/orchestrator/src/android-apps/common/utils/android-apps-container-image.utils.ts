export const resolveContainerImage = (
  image: string,
  registry: string | null,
) => {
  const trimmedImage = image.trim();
  if (!registry) {
    return trimmedImage;
  }

  const firstSegment = trimmedImage.split('/')[0] ?? '';
  const hasExplicitRegistry =
    firstSegment === 'localhost' ||
    firstSegment.includes('.') ||
    firstSegment.includes(':');

  return hasExplicitRegistry
    ? trimmedImage
    : `${registry.replace(/\/+$/, '')}/${trimmedImage}`;
};
