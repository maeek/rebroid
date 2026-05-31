import Dockerode from 'dockerode';
import { PlatformImage } from '../../docker.types';
import { isManagedImageTag, shortDockerId } from '../../docker.utils';

export const platformImageFromSummary = (
  image: Dockerode.ImageInfo,
  managed = false,
): PlatformImage => ({
  id: image.Id,
  shortId: shortDockerId(image.Id),
  repoTags:
    image.RepoTags?.filter(
      (tag) => tag !== '<none>:<none>' && !isManagedImageTag(tag),
    ) ?? [],
  repoDigests: image.RepoDigests ?? [],
  sizeBytes: image.Size ?? 0,
  sharedSizeBytes: image.SharedSize ?? 0,
  virtualSizeBytes: image.VirtualSize ?? image.Size ?? 0,
  createdAt: new Date((image.Created ?? 0) * 1000).toISOString(),
  labels: image.Labels ?? {},
  managed:
    managed ||
    image.Labels?.['com.rebroid.managed'] === 'true' ||
    image.RepoTags?.some(isManagedImageTag) === true,
  containers: image.Containers ?? 0,
});

export const platformImageFromInspect = (
  inspect: Dockerode.ImageInspectInfo,
): PlatformImage => {
  const sharedSize =
    'SharedSize' in inspect && typeof inspect.SharedSize === 'number'
      ? inspect.SharedSize
      : 0;

  return {
    id: inspect.Id,
    shortId: shortDockerId(inspect.Id),
    repoTags:
      inspect.RepoTags?.filter(
        (tag) => tag !== '<none>:<none>' && !isManagedImageTag(tag),
      ) ?? [],
    repoDigests: inspect.RepoDigests ?? [],
    sizeBytes: inspect.Size ?? 0,
    sharedSizeBytes: sharedSize,
    virtualSizeBytes: inspect.VirtualSize ?? inspect.Size ?? 0,
    createdAt: new Date(inspect.Created).toISOString(),
    labels: inspect.Config?.Labels ?? {},
    managed:
      inspect.Config?.Labels?.['com.rebroid.managed'] === 'true' ||
      inspect.RepoTags?.some(isManagedImageTag) === true,
    containers: -1,
  };
};
