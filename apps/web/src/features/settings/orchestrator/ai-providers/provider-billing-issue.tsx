import { Notice } from '@/components/ui/notice'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatUtcDate, formatUtcTime } from '@/lib/format'
import type { AutomationAiProvider } from '@/shared/contracts/ai-provider'

type BillingIssue = NonNullable<AutomationAiProvider['billingIssue']>

const billingIssueLabels: Record<BillingIssue['code'], string> = {
  credit_balance_exhausted: 'OpenAI credits exhausted',
  organization_spend_limit_exceeded: 'OpenAI organization spend limit reached',
  project_spend_limit_exceeded: 'OpenAI project spend limit reached',
  organization_usage_limit_exceeded: 'OpenAI organization usage limit reached',
  insufficient_quota: 'OpenAI quota exceeded'
}

export const ProviderBillingIssueBadge = ({ issue }: { issue: BillingIssue }) => (
  <StatusBadge
    tone='danger'
    className='w-fit'
  >
    {billingIssueLabels[issue.code]}
  </StatusBadge>
)

export const ProviderBillingIssueNotice = ({ issue }: { issue: BillingIssue }) => (
  <Notice
    tone='danger'
    title={billingIssueLabels[issue.code]}
    description={
      <>
        OpenAI rejected a model request on{' '}
        <time dateTime={issue.observedAt}>
          {formatUtcDate(issue.observedAt)} at {formatUtcTime(issue.observedAt)} UTC
        </time>
        .
      </>
    }
  />
)
