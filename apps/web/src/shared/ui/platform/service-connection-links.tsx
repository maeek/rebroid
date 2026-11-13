import { Fragment } from 'react'
import { containerResourceHref } from '@/shared/model/container-resource-href'
import { ResourceLink } from '@/shared/ui/resource-link'

type ConnectionLink = { href: string; label: string; ariaLabel?: string; prefetch?: false }

export const ServiceConnectionLinks = ({
  containerId,
  showContainerLink = true,
  serviceName,
  relatedLinks = []
}: {
  containerId?: string
  showContainerLink?: boolean
  serviceName?: string
  relatedLinks?: ConnectionLink[]
}) => {
  const links = [...relatedLinks]
  if (containerId) {
    if (showContainerLink) {
      links.push({
        href: containerResourceHref(containerId),
        label: 'Open Docker container',
        ariaLabel: serviceName ? `Open Docker container for ${serviceName}` : undefined,
        prefetch: false
      })
    }
    links.push({
      href: containerResourceHref(containerId, 'logs'),
      label: 'View logs',
      ariaLabel: serviceName ? `View logs for ${serviceName}` : undefined,
      prefetch: false
    })
  }

  if (!links.length) return null

  return (
    <div className='min-w-0 text-sm/6 touch:leading-11'>
      {links.map(({ href, label, ariaLabel, prefetch }, index) => (
        <Fragment key={href}>
          {index > 0 ? (
            <span
              aria-hidden='true'
              className='mx-1 text-foreground-muted'
            >
              &nbsp;·&nbsp;
            </span>
          ) : null}
          <ResourceLink
            href={href}
            aria-label={ariaLabel}
            prefetch={prefetch}
            className='touch:py-3.5'
          >
            {label}
          </ResourceLink>
        </Fragment>
      ))}
    </div>
  )
}
