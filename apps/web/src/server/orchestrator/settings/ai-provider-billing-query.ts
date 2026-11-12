import 'server-only'
import { z } from 'zod'
import { requireAdmin } from '@/server/auth/authorization'
import { orchestratorSettingsClient } from './client'
import type { AiProviderBillingIssueEntry, OpenAiBillingIssue } from '@/shared/contracts/ai-provider'

const billingIssueSchema = z.object({
  code: z.enum([
    'credit_balance_exhausted',
    'organization_spend_limit_exceeded',
    'project_spend_limit_exceeded',
    'organization_usage_limit_exceeded',
    'insufficient_quota'
  ]),
  observedAt: z.iso.datetime()
}) satisfies z.ZodType<OpenAiBillingIssue>

const providerBillingSchema = z.array(
  z.object({
    id: z.string().min(1).max(80),
    billingIssue: billingIssueSchema.optional()
  })
)

export const readAiProviderBillingIssues = async (signal?: AbortSignal): Promise<AiProviderBillingIssueEntry[]> => {
  await requireAdmin()
  const providers = providerBillingSchema.parse(await orchestratorSettingsClient.listAiProviders(signal))
  return providers.flatMap(({ id, billingIssue }) => (billingIssue ? [{ providerId: id, issue: billingIssue }] : []))
}
