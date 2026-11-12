import { IconFileText, IconLayoutDashboard } from '@tabler/icons-react'
import { containerResourceHref } from '@/shared/model/container-resource-href'
import { ResourceNavigation } from '@/shared/ui/resource-navigation'

export const ContainerResourceNavigation = ({ id, view }: { id?: string; view?: 'overview' | 'logs' }) => (
  <ResourceNavigation
    label='Container sections'
    items={(['overview', 'logs'] as const).map(section => ({
      id: section,
      label: section === 'logs' ? 'Logs' : 'Overview',
      icon: section === 'logs' ? <IconFileText className='size-3.5' /> : <IconLayoutDashboard className='size-3.5' />,
      href: id ? containerResourceHref(id, section) : undefined,
      current: view === section
    }))}
  />
)
