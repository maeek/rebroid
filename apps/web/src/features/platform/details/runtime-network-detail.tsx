'use client'

import { useState, type ReactNode } from 'react'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Visible } from '@/components/ui/visible'
import { RelatedContainersGrid } from '@/features/platform/details/related-containers-grid'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { removePlatformNetworkAction } from '@/server/orchestrator/platform/network-actions'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { DetailFields } from '@/shared/ui/detail-fields'
import { JsonViewer } from '@/shared/ui/json-viewer'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent } from '@/shared/ui/page/page-layout'
import { formatPlatformDate } from '@/shared/ui/platform/platform-detail-parts'
import { PlatformLabelsSection } from '@/shared/ui/platform/platform-labels-section'
import { PlatformResourceSection } from '@/shared/ui/platform/platform-resource-section'
import type { PlatformNetworkDetails } from '@/shared/contracts/platform'

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
      <RuntimeNetworkPageContent
        details={details}
        actions={
          <Button
            type='button'
            variant='danger'
            disabled={isRemoving || network.containers.length > 0}
            onClick={() => setRemoveDialogOpen(true)}
          >
            <IconTrash className='size-4' />
            Remove
          </Button>
        }
      />

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

export const RuntimeNetworkPageContent = ({
  details,
  actions,
  loading = false
}: {
  details?: PlatformNetworkDetails
  actions?: ReactNode
  loading?: boolean
}) => {
  const network = details?.network
  return (
    <>
      <PageHeader
        section={{ label: 'Docker' }}
        breadcrumbLabel={network ? undefined : 'Network'}
        trail={[{ label: 'Networks', href: '/runtime/networks' }]}
        title={network?.name ?? <Skeleton className='h-9 w-64 max-w-full max-sm:h-7' />}
        badges={
          <>
            {loading ? <Skeleton className='h-5 w-16' /> : null}
            {network?.managed ? <Badge variant='success'>managed</Badge> : null}
            {network?.internal ? <Badge variant='neutral'>internal</Badge> : null}
            {network?.attachable ? <Badge variant='neutral'>attachable</Badge> : null}
            {network?.ingress ? <Badge variant='neutral'>ingress</Badge> : null}
          </>
        }
        meta={<span className='font-mono'>{network?.shortId}</span>}
        actions={
          actions ?? (
            <Button
              type='button'
              variant='danger'
              disabled
            >
              <IconTrash className='size-4' />
              Remove
            </Button>
          )
        }
      />
      <PageContent>
        <PlatformResourceSection
          title='Overview'
          surface='plain'
          contentClassName='gap-5'
        >
          <DetailFields
            loading={loading}
            title='Network'
            fields={[
              { label: 'Network ID', value: network?.id, copyValue: network?.id, code: true, fullWidth: true },
              { label: 'Driver', value: network?.driver },
              { label: 'Subnets', value: (network?.subnets.length ?? 0) > 0 ? network?.subnets.join(', ') : 'none' },
              { label: 'Scope', value: network?.scope },
              { label: 'Gateways', value: (network?.gateways.length ?? 0) > 0 ? network?.gateways.join(', ') : 'none' },
              { label: 'Created', value: formatPlatformDate(network?.createdAt) },
              { label: 'Containers', value: network?.containers.length }
            ]}
          />
        </PlatformResourceSection>

        <PlatformResourceSection
          surface='plain'
          title='Related containers'
          contentClassName='gap-4'
          headingSpacing='compact'
        >
          <Visible when={loading || (details?.relatedContainers.length ?? 0) > 0}>
            <RelatedContainersGrid
              containers={details?.relatedContainers ?? []}
              loading={loading}
              relation='image'
            />
          </Visible>
          <Visible when={!loading && details?.relatedContainers.length === 0}>
            <p className='text-sm text-foreground-muted'>No local containers are attached to this network.</p>
          </Visible>
        </PlatformResourceSection>

        <PlatformLabelsSection
          labels={network?.labels ?? {}}
          loading={loading}
        />
        <JsonViewer
          title='Raw inspect'
          value={details?.inspect}
          loading={loading}
        />
      </PageContent>
    </>
  )
}
