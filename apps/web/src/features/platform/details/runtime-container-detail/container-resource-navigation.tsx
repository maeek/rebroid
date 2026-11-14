import { IconFileText, IconLayoutDashboard, IconTerminal2 } from '@tabler/icons-react'
import { containerResourceHref, type ContainerResourceView } from '@/shared/model/container-resource-href'
import { ResourceNavigation } from '@/shared/ui/resource-navigation'

const sections = [
  { id: 'overview', label: 'Overview', Icon: IconLayoutDashboard },
  { id: 'logs', label: 'Logs', Icon: IconFileText },
  { id: 'terminal', label: 'Terminal', Icon: IconTerminal2 }
] as const

export const ContainerResourceNavigation = ({ id, view }: { id?: string; view?: ContainerResourceView }) => (
  <ResourceNavigation
    label='Container sections'
    items={sections.map(({ id: section, label, Icon }) => ({
      id: section,
      label,
      icon: <Icon className='size-3.5' />,
      href: id ? containerResourceHref(id, section) : undefined,
      current: view === section
    }))}
  />
)
