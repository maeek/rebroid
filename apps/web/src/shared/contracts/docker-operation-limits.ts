import { z } from 'zod'
import type { OrchestratorApiSchemas } from '@rebroid/orchestrator-contracts'

export type DockerOperationLimits = OrchestratorApiSchemas['DockerOperationLimitsDto']

export const dockerOperationLimitsSchema = z
  .object({
    maxConcurrentReads: z.number().int().min(1).max(64),
    maxConcurrentLongOperations: z.number().int().min(1).max(16),
    slowRequestWarningMs: z.number().int().min(100).max(300_000),
    longOperationTimeoutMs: z.number().int().min(1000).max(3_600_000)
  })
  .strict() satisfies z.ZodType<DockerOperationLimits>
