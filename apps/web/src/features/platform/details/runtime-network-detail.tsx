'use client'

import { useState } from 'react'
import { IconTrash } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Section } from '@/components/ui/section'
import { Visible } from '@/components/ui/visible'
import { RelatedContainersGrid } from '@/features/platform/details/related-containers-grid'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { removePlatformNetworkAction } from '@/server/orchestrator/platform/network-actions'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { DefinitionTable } from '@/shared/ui/definition-table'
import { PageContent } from '@/shared/ui/page/page-layout'
import { PlatformJsonBlock, formatPlatformDate } from '@/shared/ui/platform/platform-detail-parts'
type RuntimeNetworkDetailProps = {
  details: import('@/shared/contracts/platform').PlatformNetworkDetails
}

const removePlatformNetwork = removePlatformNetworkAction

export const RuntimeNetworkDetail = ({ details }: RuntimeNetworkDetailProps) => {
  const router = useRouter()
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const network = details.network

  const removeNetwork = async () => {
    setIsRemoving(true)
    try {
      unwrapActionResult(await removePlatformNetwork(network.id))
      toast({ title: 'Network removed' })
      router.push('/runtime/networks')
    } catch (error) {
      toast({
        title: 'Could not remove network',
        description: getDisplayErrorMessage(error),
        variant: 'danger'
      })
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <>
      <PageContent>
        <Section
          title='Overview'
          surface='plain'
          contentClassName='gap-5'
        >
          <div className='flex flex-wrap items-center justify-between gap-4'>
            <div className='flex flex-wrap items-center gap-2'>
              <Visible when={network.managed}>
                <Badge variant='success'>managed</Badge>
              </Visible>
              <Visible when={network.internal}>
                <Badge variant='neutral'>internal</Badge>
              </Visible>
              <span className='font-mono text-xs text-foreground-muted'>{network.shortId}</span>
            </div>
            <Button
              type='button'
              variant='danger'
              disabled={isRemoving || network.containers.length > 0}
              onClick={() => setRemoveDialogOpen(true)}
            >
              <IconTrash className='size-4' />
              Remove
            </Button>
          </div>
          <DefinitionTable
            columns={2}
            items={[
              { label: 'Driver', value: network.driver },
              { label: 'Subnets', value: network.subnets.length > 0 ? network.subnets.join(', ') : 'none' },
              { label: 'Scope', value: network.scope },
              { label: 'Gateways', value: network.gateways.length > 0 ? network.gateways.join(', ') : 'none' },
              { label: 'Created', value: formatPlatformDate(network.createdAt) },
              { label: 'Containers', value: network.containers.length }
            ]}
          />
        </Section>

        <Section
          surface='plain'
          title='Related containers'
          contentClassName='gap-4'
          headingSpacing='compact'
        >
          <Visible when={details.relatedContainers.length > 0}>
            <RelatedContainersGrid
              containers={details.relatedContainers}
              relation='image'
            />
          </Visible>
          <Visible when={details.relatedContainers.length === 0}>
            <p className='text-sm text-foreground-muted'>No local containers are attached to this network.</p>
          </Visible>
        </Section>

        <Section
          title='Labels'
          surface='plain'
          contentClassName='gap-4'
          headingSpacing='default'
        >
          <PlatformJsonBlock value={network.labels} />
        </Section>

        <Section
          title='Raw inspect'
          surface='plain'
          collapsible
          contentClassName='gap-4'
          headingSpacing='default'
        >
          <PlatformJsonBlock value={details.inspect} />
        </Section>
      </PageContent>

      <Dialog
        modal
        open={removeDialogOpen}
        onOpenChange={setRemoveDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove network?</DialogTitle>
            <DialogDescription>
              This removes the selected network. Docker will reject the action while containers are attached.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant='danger'
              disabled={isRemoving}
              onClick={() => void removeNetwork()}
            >
              Remove network
            </Button>
            <DialogClose asChild>
              <Button variant='secondary'>Cancel</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
