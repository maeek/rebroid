export enum AndroidApplicationStatus {
  Provisioning = 'provisioning',
  Running = 'running',
  Stopped = 'stopped',
  Error = 'error',
  Removing = 'removing',
  Removed = 'removed',
}

export enum AndroidApplicationLifecycleStage {
  Queued = 'queued',
  ImageChecking = 'image_checking',
  ImagePulling = 'image_pulling',
  VolumeCreating = 'volume_creating',
  NetworkCreating = 'network_creating',
  OrchestratorNetworkConnecting = 'orchestrator_network_connecting',
  ContainerCreating = 'container_creating',
  ContainerStarting = 'container_starting',
  AndroidBooting = 'android_booting',
  ApkInstalling = 'apk_installing',
  Ready = 'ready',
  Stopping = 'stopping',
  Stopped = 'stopped',
  Removing = 'removing',
  Removed = 'removed',
  Error = 'error',
}
