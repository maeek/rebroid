import { containerResourceHref } from '@/shared/model/container-resource-href'
import { ResourceLink } from '@/shared/ui/resource-link'
import type { ServiceContainer } from '@/shared/contracts/diagnostics'
import type { DetailField } from '@/shared/ui/detail-fields'

export const serviceContainerField = (container: ServiceContainer): DetailField => ({
  label: 'Container name',
  value: (
    <ResourceLink
      href={containerResourceHref(container.id)}
      prefetch={false}
      className='touch:inline-flex touch:min-h-11 touch:items-center'
    >
      {container.name}
    </ResourceLink>
  ),
  code: true,
  copyValue: container.name
})
