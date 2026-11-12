'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getBff } from '@/lib/http/bff'
import type { AiProviderBillingIssueEntry } from '@/shared/contracts/ai-provider'

const billingIssuesKey = ['ai-provider-billing-issues'] as const
const billingIssuesRefreshIntervalMs = 10_000

const issuesByProviderId = (entries: AiProviderBillingIssueEntry[]) =>
  new Map(entries.map(({ providerId, issue }) => [providerId, issue]))

export const useAiProviderBillingIssues = (enabled: boolean) => {
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: billingIssuesKey,
    queryFn: ({ signal }) =>
      getBff<AiProviderBillingIssueEntry[]>('/api/bff/platform/ai-provider-billing-issues', signal),
    enabled,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchInterval: billingIssuesRefreshIntervalMs,
    refetchIntervalInBackground: false,
    retry: false,
    select: issuesByProviderId
  })

  return {
    issues: enabled ? data : undefined,
    resetIssues: () => void queryClient.resetQueries({ queryKey: billingIssuesKey, exact: true })
  }
}
