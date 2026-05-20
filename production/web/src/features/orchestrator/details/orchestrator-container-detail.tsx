'use client'

import { useState } from 'react'
import { IconPlayerStopFilled, IconTerminal2, IconTrash } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import {
  PlatformDetailRow,
  PlatformJsonBlock,
  formatPlatformDate
} from '@/features/orchestrator/components/platform-detail-parts'
import { LogsConsole } from '@/features/orchestrator/logs/logs-console'
import { toast } from '@/hooks/use-toast'
import {
  getPlatformContainerLogsAction,
  removePlatformContainerAction,
  stopPlatformContainerAction
} from '@/server/orchestrator/platform/actions'
import { getDisplayErrorMessage } from '../../../lib/error-utils'
import type { PlatformContainerDetails, PlatformContainerLog } from '@/server/orchestrator/platform/types'

export const OrchestratorContainerDetail = ({
  details,
  initialLogs
}: {
  details: PlatformContainerDetails
  initialLogs: PlatformContainerLog
}) => {
  const router = useRouter()
  const container = details.container
  const relatedImage = details.relatedImage
  const [logs, setLogs] = useState(initialLogs)
  const [isRefreshingLogs, setIsRefreshingLogs] = useState(false)
  const [pendingAction, setPendingAction] = useState<'stop' | 'remove' | null>(null)
  const [isActing, setIsActing] = useState(false)
  const [forceRemove, setForceRemove] = useState(container.state === 'removing')

  const refreshLogs = async () => {
    setIsRefreshingLogs(true)
    try {
      setLogs(await getPlatformContainerLogsAction(container.id))
    } catch (error) {
      toast({
        title: 'Could not refresh logs',
        description: getDisplayErrorMessage(error),
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
        await removePlatformContainerAction(container.id, forceRemove)
        toast({ title: forceRemove ? 'Container force-removed' : 'Container removed' })
        router.push('/settings/orchestrator/containers')
      }
      setPendingAction(null)
    } catch (error) {
      toast({
        title: pendingAction === 'stop' ? 'Could not stop container' : 'Could not remove container',
        description: getDisplayErrorMessage(error),
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
          className='bg-card/40'
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
            <Visible when={relatedImage}>
              <>
                <PlatformDetailRow
                  label='Tags'
                  value={relatedImage?.repoTags.join(', ') || relatedImage?.shortId || 'unknown'}
                />
                <PlatformDetailRow
                  label='Size'
                  value={relatedImage ? `${(relatedImage.sizeBytes / 1024 / 1024).toFixed(2)} MB` : 'unknown'}
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
          <Section
            title='Related networks'
            boxed
            contentClassName='gap-3'
          >
            <Visible when={details.relatedNetworks.length > 0}>
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
            </Visible>
            <Visible when={details.relatedNetworks.length === 0}>
              <p className='text-sm text-secondary-foreground'>No related networks were found for this container.</p>
            </Visible>
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
          <LogsConsole
            log={logs}
            isRefreshing={isRefreshingLogs}
            onRefresh={() => void refreshLogs()}
            emptyMessage='No logs returned for this container.'
            collectedAtPrefix='Recent Docker logs collected at'
            formatCollectedAt={formatPlatformDate}
            controls={<p className='text-sm text-secondary-foreground'>Recent Docker logs for this container.</p>}
            outputClassName='max-h-128 rounded-lg bg-black/35 leading-6'
          />
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
            setForceRemove(container.state === 'removing')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingAction === 'stop' ? 'Stop container?' : 'Remove container?'}</DialogTitle>
            <DialogDescription>
              {pendingAction === 'stop'
                ? 'This stops the selected Docker container without deleting it.'
                : 'Remove the selected Docker container. Enable force removal when Docker reports the container as stuck in removing or when a normal removal does not complete.'}
            </DialogDescription>
          </DialogHeader>
          <Visible when={pendingAction === 'remove'}>
            <label className='flex items-start gap-3 rounded-lg border border-border/60 bg-background/35 px-3 py-3'>
              <Checkbox
                checked={forceRemove}
                onCheckedChange={checked => setForceRemove(checked === true)}
                disabled={isActing}
              />
              <div className='space-y-1 text-sm'>
                <div className='font-medium'>Force removal</div>
                <p className='text-secondary-foreground'>
                  Sends Docker a forced delete request and retries briefly if removal is already in progress. Persistent
                  volumes are not removed by this action.
                </p>
              </div>
            </label>
          </Visible>
          <DialogFooter>
            <Button
              variant={pendingAction === 'stop' ? 'secondary' : 'destructive'}
              disabled={!pendingAction || isActing}
              onClick={() => void runAction()}
            >
              {pendingAction === 'stop'
                ? 'Stop container'
                : forceRemove
                  ? 'Force remove container'
                  : 'Remove container'}
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
