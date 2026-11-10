import { IconHistory, IconPencil } from '@tabler/icons-react'
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
        {
          id: 'editor',
          label: 'Editor',
          icon: <IconPencil className='size-3.5' />,
          href,
          current: active === 'editor'
        },
        {
          id: 'history',
          label: 'Run history',
          icon: <IconHistory className='size-3.5' />,
          href: href ? `${href}/traces` : undefined,
          current: active === 'history'
        }
      ]}
    />
  )
}
