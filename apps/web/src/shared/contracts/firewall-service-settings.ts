import { z } from 'zod'

export const firewallServiceSettingsSchema = z.object({
  endpoint: z.string().trim().min(1).nullable(),
  timeoutMs: z.number().int().min(100).max(120_000)
})
