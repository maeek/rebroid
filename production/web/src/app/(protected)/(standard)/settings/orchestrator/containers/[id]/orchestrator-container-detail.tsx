'use client'

import { useState } from 'react'
import { IconPlayerStopFilled, IconRefresh, IconTerminal2, IconTrash } from '@tabler/icons-react'
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
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  getPlatformContainerLogsAction,
  removePlatformContainerAction,
  stopPlatformContainerAction
} from '@/server/orchestrator/platform/actions'
import { ContainerStateBadge } from '../../_components/orchestrator-containers-table-parts'
import { PlatformDetailRow, PlatformJsonBlock, formatPlatformDate } from '../../_components/platform-detail-parts'
import type { PlatformContainerDetails, PlatformContainerLog } from '@/server/orchestrator/platform/types'

export const OrchestratorContainerDetail = ({
  details,
  initialLogs
}: {
  details: PlatformContainerDetails
  initialLogs: PlatformContainerLog
}) => {
  const router = useRouter()
  const [logs, setLogs] = useState(initialLogs)
  const [isRefreshingLogs, setIsRefreshingLogs] = useState(false)
  const [pendingAction, setPendingAction] = useState<'stop' | 'remove' | null>(null)
  const [isActing, setIsActing] = useState(false)
  const container = details.container

  const refreshLogs = async () => {
    setIsRefreshingLogs(true)
    try {
      setLogs(await getPlatformContainerLogsAction(container.id))
    } catch (error) {
      toast({
        title: 'Could not refresh logs',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setIsRefreshingLogs(false)
    }
  }

  const runAction = async () => {
    if (!pendingAction) {
      return
    }

    setIsActing(true)
    try {
      if (pendingAction === 'stop') {
        await stopPlatformContainerAction(container.id)
        toast({ title: 'Container stopped' })
        router.refresh()
      } else {
        await removePlatformContainerAction(container.id)
        toast({ title: 'Container removed' })
        router.push('/settings/orchestrator/containers')
      }
      setPendingAction(null)
    } catch (error) {
      toast({
        title: pendingAction === 'stop' ? 'Could not stop container' : 'Could not remove container',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setIsActing(false)
    }
  }

  return (
    <>
      <section className='flex w-full flex-col gap-6 px-6 pb-16 max-sm:px-4'>
        <Section
          boxed
          className='bg-card/50'
          contentClassName='gap-5'
        >
          <div className='flex flex-wrap items-center justify-between gap-4'>
            <div className='flex min-w-0 flex-col gap-2'>
              <div className='flex flex-wrap items-center gap-2'>
                <h3 className='text-xl font-medium'>Overview</h3>
                <Visible when={container.managed}>
                  <Badge variant='status'>managed</Badge>
                </Visible>
                <ContainerStateBadge state={container.state} />
              </div>
              <div className='font-mono text-xs text-muted-foreground'>{container.id}</div>
            </div>
            <div className='flex flex-wrap gap-2'>
              <Button
                type='button'
                variant='secondary'
                disabled={container.state !== 'running'}
                onClick={() => setPendingAction('stop')}
              >
                <IconPlayerStopFilled className='size-4' />
                Stop
              </Button>
              <Button
                type='button'
                variant='destructive'
                onClick={() => setPendingAction('remove')}
              >
                <IconTrash className='size-4' />
                Remove
              </Button>
            </div>
          </div>
          <div className='grid gap-6 xl:grid-cols-2'>
            <div>
              <PlatformDetailRow
                label='Image'
                value={container.image}
              />
              <PlatformDetailRow
                label='Image ID'
                value={container.imageId}
              />
              <PlatformDetailRow
                label='Command'
                value={container.command || 'none'}
              />
              <PlatformDetailRow
                label='Created'
                value={formatPlatformDate(container.createdAt)}
              />
              <PlatformDetailRow
                label='Status'
                value={container.status}
              />
            </div>
            <div>
              <PlatformDetailRow
                label='Application'
                value={container.applicationId ?? 'unmanaged'}
              />
              <PlatformDetailRow
                label='Component'
                value={container.component ?? 'none'}
              />
              <PlatformDetailRow
                label='Networks'
                value={container.networks.length > 0 ? container.networks.join(', ') : 'none'}
              />
              <PlatformDetailRow
                label='Ports'
                value={
                  container.ports.length > 0
                    ? container.ports
                        .map(port => `${port.ip ?? '*'}:${port.publicPort ?? '-'} -> ${port.privatePort}/${port.type}`)
                        .join(', ')
                    : 'none'
                }
              />
              <PlatformDetailRow
                label='Names'
                value={container.names.join(', ')}
              />
            </div>
          </div>
        </Section>

        <div className='grid gap-6 xl:grid-cols-2'>
          <Section
            title='Related image'
            boxed
            contentClassName='gap-3'
          >
            {details.relatedImage ? (
              <>
                <PlatformDetailRow
                  label='Tags'
                  value={details.relatedImage.repoTags.join(', ') || details.relatedImage.shortId}
                />
                <PlatformDetailRow
                  label='Size'
                  value={`${(details.relatedImage.sizeBytes / 1024 / 1024).toFixed(2)} MB`}
                />
                <PlatformDetailRow
                  label='Created'
                  value={formatPlatformDate(details.relatedImage.createdAt)}
                />
              </>
            ) : (
              <p className='text-sm text-secondary-foreground'>The related image is no longer present locally.</p>
            )}
          </Section>
          <Section
            title='Related networks'
            boxed
            contentClassName='gap-3'
          >
            {details.relatedNetworks.length > 0 ? (
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
                    {details.relatedNetworks.map(network => (
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
            ) : (
              <p className='text-sm text-secondary-foreground'>No related networks were found for this container.</p>
            )}
          </Section>
        </div>

        <Section
          title={
            <div className='flex items-center gap-2'>
              <IconTerminal2 className='size-5' />
              Logs
            </div>
          }
          boxed
          contentClassName='gap-4'
        >
          <div className='flex items-center justify-between gap-3'>
            <p className='text-sm text-secondary-foreground'>
              Recent Docker logs collected at {formatPlatformDate(logs.collectedAt)}.
            </p>
            <Button
              type='button'
              variant='secondary'
              disabled={isRefreshingLogs}
              onClick={() => void refreshLogs()}
            >
              <IconRefresh
                className={cn('size-4', {
                  'animate-spin': isRefreshingLogs
                })}
              />
              Refresh
            </Button>
          </div>
          <pre className='max-h-[32rem] overflow-auto rounded-lg border border-border/60 bg-black/35 p-4 font-mono text-xs leading-6 text-secondary-foreground'>
            {logs.output || 'No logs returned for this container.'}
          </pre>
        </Section>

        <Section
          title='Labels'
          boxed
          contentClassName='gap-4'
          titleClassName='pb-4'
        >
          <PlatformJsonBlock value={container.labels} />
        </Section>

        <Section
          title='Raw inspect'
          boxed
          contentClassName='gap-4'
        >
          <PlatformJsonBlock value={details.inspect} />
        </Section>
      </section>

      <Dialog
        modal
        open={Boolean(pendingAction)}
        onOpenChange={open => {
          if (!open) {
            setPendingAction(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingAction === 'stop' ? 'Stop container?' : 'Remove container?'}</DialogTitle>
            <DialogDescription>
              {pendingAction === 'stop'
                ? 'This stops the selected Docker container without deleting it.'
                : 'This force-removes the selected Docker container. Persistent volumes are not removed by this action.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant={pendingAction === 'stop' ? 'secondary' : 'destructive'}
              disabled={!pendingAction || isActing}
              onClick={() => void runAction()}
            >
              {pendingAction === 'stop' ? 'Stop container' : 'Remove container'}
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
