import { cn } from '@/lib/utils'
import { containerResourceHref } from '@/shared/model/container-resource-href'
import { ResourceLink } from '@/shared/ui/resource-link'

export const DockerContainerLinks = ({
  containerId,
  serviceName,
  className
}: {
  containerId?: string
  serviceName?: string
  className?: string
}) =>
  containerId ? (
    <div className={cn('flex flex-wrap gap-x-3 gap-y-1 text-sm', className)}>
      <ResourceLink
        href={containerResourceHref(containerId)}
        aria-label={serviceName ? `Open Docker container for ${serviceName}` : undefined}
        prefetch={false}
      >
        Open Docker container
      </ResourceLink>
      <ResourceLink
        href={containerResourceHref(containerId, 'logs')}
        aria-label={serviceName ? `View logs for ${serviceName}` : undefined}
        prefetch={false}
      >
        View logs
      </ResourceLink>
    </div>
  ) : null
