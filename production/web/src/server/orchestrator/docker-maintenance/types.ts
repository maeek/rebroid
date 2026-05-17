export interface DockerPruneResponse {
  ContainersDeleted?: string[]
  ImagesDeleted?: Array<{ Deleted?: string; Untagged?: string }>
  NetworksDeleted?: string[]
  VolumesDeleted?: string[]
  SpaceReclaimed?: number
}

export interface DockerPruneAllResponse {
  containers: DockerPruneResponse
  networks: DockerPruneResponse
  images: DockerPruneResponse
  volumes: DockerPruneResponse
}
