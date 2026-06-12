'use client'

import { Section } from '@/components/ui/section'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Visible } from '@/components/ui/visible'
import { useContainerDetailContext } from '@/features/orchestrator/details/orchestrator-container-detail/container-detail-context'
import {
  getRelatedImageSize,
  getRelatedImageTags
} from '@/features/orchestrator/details/orchestrator-container-detail/container-detail-utils'
import { PlatformDetailRow, formatPlatformDate } from '@/shared/ui/platform/platform-detail-parts'

export const RelatedImageSection = () => {
  const { details } = useContainerDetailContext()
  const relatedImage = details.relatedImage

  return (
    <Section
      title='Related image'
      boxed
      contentClassName='gap-3'
    >
      <Visible when={relatedImage}>
        <>
          <PlatformDetailRow
            label='Tags'
            value={getRelatedImageTags(relatedImage)}
          />
          <PlatformDetailRow
            label='Size'
            value={getRelatedImageSize(relatedImage)}
          />
          <PlatformDetailRow
            label='Created'
            value={formatPlatformDate(relatedImage?.createdAt ?? null)}
          />
        </>
      </Visible>
      <Visible when={!relatedImage}>
        <p className='text-sm text-secondary-foreground'>The related image is no longer present locally.</p>
      </Visible>
    </Section>
  )
}

export const RelatedNetworksSection = () => {
  const { details } = useContainerDetailContext()
  const networks = details.relatedNetworks

  return (
    <Section
      title='Related networks'
      contentClassName='gap-3'
    >
      <Visible when={networks.length > 0}>
        <div className='overflow-hidden rounded-lg border border-border/60 bg-background/25'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Subnet</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {networks.map(network => (
                <TableRow key={network.id}>
                  <TableCell className='font-medium'>{network.name}</TableCell>
                  <TableCell className='text-secondary-foreground'>{network.driver}</TableCell>
                  <TableCell className='text-secondary-foreground'>
                    {network.subnets.length > 0 ? network.subnets.join(', ') : 'none'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Visible>
      <Visible when={networks.length === 0}>
        <p className='text-sm text-secondary-foreground'>No related networks were found for this container.</p>
      </Visible>
    </Section>
  )
}
