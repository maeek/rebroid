'use client'

import { useState } from 'react'
import { IconEye, IconTrash } from '@tabler/icons-react'
import Link from 'next/link'
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Visible } from '@/components/ui/visible'
import { ContainerStateBadge } from '@/features/orchestrator/components/orchestrator-containers-table-parts'
import { toast } from '@/hooks/use-toast'
import { removePlatformNetworkAction } from '@/server/orchestrator/platform/network-actions'
import { PlatformDetailRow, PlatformJsonBlock, formatPlatformDate } from '@/shared/ui/platform/platform-detail-parts'
type NetworkDetailModel = {
  id: string
  shortId: string
  driver: string
  scope: string
  createdAt: string | null
  internal: boolean
  managed: boolean
  containers: string[]
  subnets: string[]
  gateways: string[]
  labels: Record<string, string>
}

type NetworkDetailContainer = {
  id: string
  names: string[]
  shortId: string
  state: string
  image: string
}

type OrchestratorNetworkDetailProps = {
  details: {
    network: NetworkDetailModel
    inspect: unknown
    relatedContainers: NetworkDetailContainer[]
  }
}

const removePlatformNetwork = removePlatformNetworkAction

export const OrchestratorNetworkDetail = ({ details }: OrchestratorNetworkDetailProps) => {
  const router = useRouter()
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const network = details.network

  const removeNetwork = async () => {
    setIsRemoving(true)
    try {
      await removePlatformNetwork(network.id)
      toast({ title: 'Network removed' })
      router.push('/infrastructure/networks')
    } catch (error) {
      toast({
        title: 'Could not remove network',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <>
      <section className='flex w-full flex-col gap-6 px-6 pb-16 max-sm:px-4'>
        <Section
          title='Overview'
          boxed
          contentClassName='gap-5'
        >
          <div className='flex flex-wrap items-center justify-between gap-4'>
            <div className='flex flex-wrap items-center gap-2'>
              <Visible when={network.managed}>
                <Badge variant='status'>managed</Badge>
              </Visible>
              <Visible when={network.internal}>
                <Badge variant='secondary'>internal</Badge>
              </Visible>
              <span className='font-mono text-xs text-muted-foreground'>{network.shortId}</span>
            </div>
            <Button
              type='button'
              variant='destructive'
              disabled={isRemoving || network.containers.length > 0}
              onClick={() => setRemoveDialogOpen(true)}
            >
              <IconTrash className='size-4' />
              Remove
            </Button>
          </div>
          <div className='grid gap-6 xl:grid-cols-2'>
            <div>
              <PlatformDetailRow
                label='Driver'
                value={network.driver}
              />
              <PlatformDetailRow
                label='Scope'
                value={network.scope}
              />
              <PlatformDetailRow
                label='Created'
                value={formatPlatformDate(network.createdAt)}
              />
            </div>
            <div>
              <PlatformDetailRow
                label='Subnets'
                value={network.subnets.length > 0 ? network.subnets.join(', ') : 'none'}
              />
              <PlatformDetailRow
                label='Gateways'
                value={network.gateways.length > 0 ? network.gateways.join(', ') : 'none'}
              />
              <PlatformDetailRow
                label='Containers'
                value={network.containers.length}
              />
            </div>
          </div>
        </Section>

        <Section
          title='Related containers'
          contentClassName='gap-4'
          titleClassName='pb-2'
        >
          <Visible when={details.relatedContainers.length > 0}>
            <div className='overflow-hidden rounded-lg border border-border/60 bg-surface-band/35'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Container</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Image</TableHead>
                    <TableHead className='text-right'>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {details.relatedContainers.map(container => (
                    <TableRow key={container.id}>
                      <TableCell className='font-medium'>{container.names[0] ?? container.shortId}</TableCell>
                      <TableCell>
                        <ContainerStateBadge state={container.state} />
                      </TableCell>
                      <TableCell className='text-foreground-muted'>{container.image}</TableCell>
                      <TableCell className='text-right'>
                        <Button
                          asChild
                          variant='secondary'
                        >
                          <Link href={`/infrastructure/containers/${container.id}`}>
                            <IconEye className='size-4' />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Visible>
          <Visible when={details.relatedContainers.length === 0}>
            <p className='text-sm text-foreground-muted'>No local containers are attached to this network.</p>
          </Visible>
        </Section>

        <Section
          title='Labels'
          boxed
          contentClassName='gap-4'
          titleClassName='pb-4'
        >
          <PlatformJsonBlock value={network.labels} />
        </Section>

        <Section
          title='Raw inspect'
          boxed
          contentClassName='gap-4'
          titleClassName='pb-4'
        >
          <PlatformJsonBlock value={details.inspect} />
        </Section>
      </section>

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
              variant='destructive'
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
