'use client'

import type { ReactNode } from 'react'
import { IconApps, IconArrowUpRight, IconBox, IconNetwork } from '@tabler/icons-react'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import { PlatformResourceSection } from '@/shared/ui/platform/platform-resource-section'
import { useContainerDetailContext } from './container-detail-context'
import { getRelatedImageSize, getRelatedImageTags } from './container-detail-utils'

const RelatedResourcesLayout = ({ children }: { children: ReactNode }) => (
  <PlatformResourceSection
    title='Related resources'
    surface='plain'
  >
    <ul className='grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3'>{children}</ul>
  </PlatformResourceSection>
)

export const RelatedResourcesSkeleton = () => (
  <RelatedResourcesLayout>
    {Array.from({ length: 3 }, (_, index) => (
      <li key={index}>
        <Skeleton className='h-24 w-full rounded-control' />
      </li>
    ))}
  </RelatedResourcesLayout>
)

const ResourceLink = ({
  href,
  kind,
  name,
  metadata,
  icon
}: {
  href: string
  kind: string
  name: string
  metadata: string
  icon: ReactNode
}) => (
  <li className='min-w-0'>
    <Link
      href={href}
      className='group flex h-full min-w-0 items-start gap-3 rounded-control border border-surface-border/60 p-4 transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
    >
      <span className='mt-0.5 shrink-0 text-foreground-muted'>{icon}</span>
      <span className='grid min-w-0 flex-1 gap-1'>
        <span className='text-xs font-medium text-foreground-muted'>{kind}</span>
        <span className='break-words text-sm font-medium text-primary [overflow-wrap:anywhere]'>{name}</span>
        <span className='text-xs leading-5 text-foreground-muted [overflow-wrap:anywhere]'>{metadata}</span>
      </span>
      <IconArrowUpRight className='mt-1 size-4 shrink-0 text-foreground-muted group-hover:text-primary' />
    </Link>
  </li>
)

export const RelatedResourcesSection = () => {
  const { details } = useContainerDetailContext()
  const { container, relatedImage, relatedNetworks } = details
  return (
    <RelatedResourcesLayout>
      {container.applicationId ? (
        <ResourceLink
          href={`/app/${encodeURIComponent(container.applicationId)}`}
          kind='Application'
          name={container.applicationName || 'Open application'}
          metadata={container.applicationId}
          icon={<IconApps className='size-5' />}
        />
      ) : null}
      {relatedImage ? (
        <ResourceLink
          href={`/runtime/images/${encodeURIComponent(relatedImage.id)}`}
          kind='Image'
          name={getRelatedImageTags(relatedImage)}
          metadata={`${getRelatedImageSize(relatedImage)} · ${relatedImage.shortId}`}
          icon={<IconBox className='size-5' />}
        />
      ) : null}
      {relatedNetworks.map(network => (
        <ResourceLink
          key={network.id}
          href={`/runtime/networks/${encodeURIComponent(network.id)}`}
          kind='Network'
          name={network.name}
          metadata={[network.driver, ...network.subnets].join(' · ')}
          icon={<IconNetwork className='size-5' />}
        />
      ))}
      {!relatedImage ? (
        <li className='p-4 text-sm text-foreground-muted'>The container image is no longer present locally.</li>
      ) : null}
      {relatedNetworks.length === 0 ? (
        <li className='p-4 text-sm text-foreground-muted'>No networks attached.</li>
      ) : null}
    </RelatedResourcesLayout>
  )
}
