import { z } from 'zod'

export const ocrServiceSettingsSchema = z.object({
  endpoint: z
    .string()
    .trim()
    .pipe(z.url({ protocol: /^https?$/, error: 'Enter an HTTP or HTTPS URL.' }))
    .nullable(),
  timeoutMs: z.number().int().min(100).max(120_000),
  maxImageDimension: z.number().int().min(320).max(4096),
  minConfidence: z.number().min(0).max(1),
  language: z.string().trim().min(1).max(16)
})
