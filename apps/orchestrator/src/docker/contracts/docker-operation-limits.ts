export interface DockerOperationLimits {
  maxConcurrentReads: number;
  maxConcurrentLongOperations: number;
  slowRequestWarningMs: number;
  longOperationTimeoutMs: number;
}
