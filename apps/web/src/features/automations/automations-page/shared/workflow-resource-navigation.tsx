import { ResourceNavigation } from '@/shared/ui/resource-navigation'

export const WorkflowResourceNavigation = ({
  workflowId,
  active,
  loading = false
}: {
  workflowId?: string
  active: 'editor' | 'history'
  loading?: boolean
}) => {
  if (!workflowId && !loading) return null
  const href = workflowId ? `/automations/${encodeURIComponent(workflowId)}` : undefined
  return (
    <ResourceNavigation
      label='Workflow navigation'
      items={[
        { id: 'editor', label: 'Editor', href, current: active === 'editor' },
        {
          id: 'history',
          label: 'Run history',
          href: href ? `${href}/traces` : undefined,
          current: active === 'history'
        }
      ]}
    />
  )
}
