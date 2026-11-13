import { IconBox, IconFileText } from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { containerResourceHref } from '@/shared/model/container-resource-href'

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
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <Button
        asChild
        variant='outline'
        size='sm'
      >
        <Link
          href={containerResourceHref(containerId)}
          aria-label={serviceName ? `Open Docker container for ${serviceName}` : undefined}
          prefetch={false}
        >
          <IconBox aria-hidden='true' />
          Open Docker container
        </Link>
      </Button>
      <Button
        asChild
        variant='outline'
        size='sm'
      >
        <Link
          href={containerResourceHref(containerId, 'logs')}
          aria-label={serviceName ? `View logs for ${serviceName}` : undefined}
          prefetch={false}
        >
          <IconFileText aria-hidden='true' />
          View logs
        </Link>
      </Button>
    </div>
  ) : null
