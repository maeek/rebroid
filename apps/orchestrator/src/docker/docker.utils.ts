export const shortDockerId = (id: string) =>
  id.replace(/^sha256:/, '').slice(0, 12);

const managedImageRepository = 'rebroid.local/managed';

export const managedImageTag = (imageId: string) =>
  `${managedImageRepository}:${shortDockerId(imageId)}`;

export const isManagedImageTag = (tag: string) =>
  tag.startsWith(`${managedImageRepository}:`);

export const isString = (value: string | undefined): value is string =>
  typeof value === 'string' && value.length > 0;
