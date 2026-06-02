'use client'

import { useState } from 'react'
import { IconLoader2, IconPlayerStopFilled, IconRefresh, IconTerminal2, IconTrash } from '@tabler/icons-react'
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
  formatPlatformBytes,
  formatPlatformDate
} from '@/features/orchestrator/components/platform-detail-parts'
import { LogsConsole } from '@/features/orchestrator/logs/logs-console'
import { QuickGlanceCard } from '@/features/settings/components/quick-glance-card'
import { usePollingQuery } from '@/hooks/use-polling-query'
import { toast } from '@/hooks/use-toast'
import {
  getPlatformContainerLogsAction,
  getPlatformContainerStatsAction,
  removePlatformContainerAction,
  stopPlatformContainerAction
} from '@/server/orchestrator/platform/actions'
import { getDisplayErrorMessage } from '../../../lib/error-utils'
import type {
  PlatformContainerDetails,
  PlatformContainerLog,
  PlatformContainerStats
} from '@/server/orchestrator/platform/types'

const containerStatsRefreshIntervalMs = 15_000

const formatPercent = (value: number) => `${value.toFixed(1)}%`

type ContainerPendingAction = 'stop' | 'remove'

const actionDialogCopy: Record<
  ContainerPendingAction,
  {
    title: string
    description: string
    errorTitle: string
    buttonVariant: 'secondary' | 'destructive'
  }
> = {
  stop: {
    title: 'Stop container?',
    description: 'This stops the selected Docker container without deleting it.',
    errorTitle: 'Could not stop container',
    buttonVariant: 'secondary'
  },
  remove: {
    title: 'Remove container?',
    description:
      'Remove the selected Docker container. Enable force removal when Docker reports the container as stuck in removing or when a normal removal does not complete.',
    errorTitle: 'Could not remove container',
    buttonVariant: 'destructive'
  }
}

const formatContainerNetworks = (networks: PlatformContainerDetails['container']['networks']) =>
  networks.length > 0 ? networks.join(', ') : 'none'

const formatContainerPorts = (ports: PlatformContainerDetails['container']['ports']) =>
  ports.length > 0
    ? ports.map(port => `${port.ip ?? '*'}:${port.publicPort ?? '-'} -> ${port.privatePort}/${port.type}`).join(', ')
    : 'none'

const formatStatsSample = (
  containerState: PlatformContainerDetails['container']['state'],
  stats?: PlatformContainerStats
) => {
  if (stats) {
    return `Last sample: ${formatPlatformDate(stats.collectedAt)}`
  }

  return containerState === 'running'
    ? 'Collecting live Docker stats...'
    : 'Live Docker stats are available while the container is running.'
}

const getMemoryStatsHint = (stats?: PlatformContainerStats) =>
  stats?.memoryLimitBytes
    ? `${formatPlatformBytes(stats.memoryLimitBytes)} Docker limit`
    : 'Working-set memory from Docker stats'

const getCpuStatsHint = (containerState: PlatformContainerDetails['container']['state']) =>
  containerState === 'running' ? 'Live Docker CPU usage' : 'Container is not running'

const formatCpuStatsValue = (stats?: PlatformContainerStats) =>
  stats ? formatPercent(stats.cpuUsagePercent) : 'Unavailable'

const formatByteStatsValue = (value?: number) => (value === undefined ? 'Unavailable' : formatPlatformBytes(value))

const isStatsRefreshDisabled = (
  containerState: PlatformContainerDetails['container']['state'],
  isRefreshingStats: boolean
) => containerState !== 'running' || isRefreshingStats

const getRefreshIcon = (isRefreshingStats: boolean) =>
  isRefreshingStats ? <IconLoader2 className='size-4 animate-spin' /> : <IconRefresh className='size-4' />

const getRelatedImageTags = (relatedImage?: PlatformContainerDetails['relatedImage']) =>
  relatedImage?.repoTags.join(', ') || relatedImage?.shortId || 'unknown'

const getRelatedImageSize = (relatedImage?: PlatformContainerDetails['relatedImage']) =>
  relatedImage ? `${(relatedImage.sizeBytes / 1024 / 1024).toFixed(2)} MB` : 'unknown'

const getActionButtonLabel = (pendingAction: ContainerPendingAction, forceRemove: boolean) => {
  if (pendingAction === 'stop') {
    return 'Stop container'
  }

  return forceRemove ? 'Force remove container' : 'Remove container'
}

const ContainerOverviewHeader = ({
  container,
  onAction
}: {
  container: PlatformContainerDetails['container']
  onAction: (action: ContainerPendingAction) => void
}) => (
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
        onClick={() => onAction('stop')}
      >
        <IconPlayerStopFilled className='size-4' />
        Stop
      </Button>
      <Button
        type='button'
        variant='destructive'
        onClick={() => onAction('remove')}
      >
        <IconTrash className='size-4' />
        Remove
      </Button>
    </div>
  </div>
)

const ContainerIdentityDetails = ({ container }: { container: PlatformContainerDetails['container'] }) => (
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
)

const ContainerRuntimeDetails = ({ container }: { container: PlatformContainerDetails['container'] }) => (
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
      value={formatContainerNetworks(container.networks)}
    />
    <PlatformDetailRow
      label='Ports'
      value={formatContainerPorts(container.ports)}
    />
    <PlatformDetailRow
      label='Names'
      value={container.names.join(', ')}
    />
  </div>
)

const ContainerOverviewSection = ({
  container,
  onAction
}: {
  container: PlatformContainerDetails['container']
  onAction: (action: ContainerPendingAction) => void
}) => (
  <Section
    boxed
    className='bg-card/40'
    contentClassName='gap-5'
  >
    <ContainerOverviewHeader
      container={container}
      onAction={onAction}
    />
    <div className='grid gap-6 xl:grid-cols-2'>
      <ContainerIdentityDetails container={container} />
      <ContainerRuntimeDetails container={container} />
    </div>
  </Section>
)

const LiveResourcesSection = ({
  containerState,
  stats,
  statsError,
  isRefreshingStats,
  onRefresh
}: {
  containerState: PlatformContainerDetails['container']['state']
  stats?: PlatformContainerStats
  statsError: string | null
  isRefreshingStats: boolean
  onRefresh: () => void
}) => (
  <Section
    boxed
    contentClassName='gap-4'
  >
    <div className='flex flex-wrap items-center justify-between gap-3'>
      <div>
        <h3 className='font-medium'>Live resources</h3>
        <p className='mt-1 text-sm text-secondary-foreground'>Docker stats sampled for this container.</p>
      </div>
      <Button
        type='button'
        variant='secondary'
        size='sm'
        disabled={isStatsRefreshDisabled(containerState, isRefreshingStats)}
        onClick={onRefresh}
      >
        {getRefreshIcon(isRefreshingStats)}
        Refresh
      </Button>
    </div>
    <Visible when={statsError}>
      <div className='rounded-lg border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive'>
        {statsError}
      </div>
    </Visible>
    <div className='grid grid-cols-4 gap-3 max-xl:grid-cols-2 max-sm:grid-cols-1'>
      <QuickGlanceCard
        label='CPU'
        value={formatCpuStatsValue(stats)}
        hint={getCpuStatsHint(containerState)}
      />
      <QuickGlanceCard
        label='Memory'
        value={formatByteStatsValue(stats?.memoryUsageBytes)}
        hint={getMemoryStatsHint(stats)}
      />
      <QuickGlanceCard
        label='Network received'
        value={formatByteStatsValue(stats?.networkRxBytes)}
        hint='Summed across container interfaces'
      />
      <QuickGlanceCard
        label='Network transmitted'
        value={formatByteStatsValue(stats?.networkTxBytes)}
        hint='Summed across container interfaces'
      />
    </div>
    <div className='text-xs text-secondary-foreground'>{formatStatsSample(containerState, stats)}</div>
  </Section>
)

const RelatedImageSection = ({ relatedImage }: { relatedImage: PlatformContainerDetails['relatedImage'] }) => (
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

const RelatedNetworksSection = ({ networks }: { networks: PlatformContainerDetails['relatedNetworks'] }) => (
  <Section
    title='Related networks'
    boxed
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

const ContainerLogsSection = ({
  logs,
  isRefreshingLogs,
  onRefresh
}: {
  logs: PlatformContainerLog
  isRefreshingLogs: boolean
  onRefresh: () => void
}) => (
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
      onRefresh={onRefresh}
      emptyMessage='No logs returned for this container.'
      collectedAtPrefix='Recent Docker logs collected at'
      formatCollectedAt={formatPlatformDate}
      controls={<p className='text-sm text-secondary-foreground'>Recent Docker logs for this container.</p>}
      outputClassName='max-h-128 rounded-lg bg-black/35 leading-6'
    />
  </Section>
)

const ContainerActionDialog = ({
  containerState,
  forceRemove,
  isActing,
  pendingAction,
  onForceRemoveChange,
  onOpenChange,
  onRunAction
}: {
  containerState: PlatformContainerDetails['container']['state']
  forceRemove: boolean
  isActing: boolean
  pendingAction: ContainerPendingAction | null
  onForceRemoveChange: (forceRemove: boolean) => void
  onOpenChange: (open: boolean) => void
  onRunAction: () => void
}) => {
  const copy = pendingAction ? actionDialogCopy[pendingAction] : actionDialogCopy.remove

  return (
    <Dialog
      modal
      open={Boolean(pendingAction)}
      onOpenChange={open => {
        onOpenChange(open)
        if (!open) {
          onForceRemoveChange(containerState === 'removing')
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <Visible when={pendingAction === 'remove'}>
          <label className='flex items-start gap-3 rounded-lg border border-border/60 bg-background/35 px-3 py-3'>
            <Checkbox
              checked={forceRemove}
              onCheckedChange={checked => onForceRemoveChange(checked === true)}
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
            variant={copy.buttonVariant}
            disabled={!pendingAction || isActing}
            onClick={onRunAction}
          >
            {pendingAction ? getActionButtonLabel(pendingAction, forceRemove) : 'Remove container'}
          </Button>
          <DialogClose asChild>
            <Button variant='secondary'>Cancel</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const useContainerStats = (container: PlatformContainerDetails['container']) => {
  const {
    data: stats,
    error: caughtStatsError,
    isValidating: isRefreshingStats,
    mutate: refreshStats
  } = usePollingQuery<PlatformContainerStats>(
    ['orchestrator', 'containers', container.id, 'stats'],
    () => getPlatformContainerStatsAction(container.id),
    {
      enabled: container.state === 'running',
      intervalMs: containerStatsRefreshIntervalMs
    }
  )
  const statsError = caughtStatsError
    ? getDisplayErrorMessage(caughtStatsError, 'Could not collect live container stats.')
    : null

  return { stats, statsError, isRefreshingStats, refreshStats }
}

const useContainerLogs = (containerId: string, initialLogs: PlatformContainerLog) => {
  const [logs, setLogs] = useState(initialLogs)
  const [isRefreshingLogs, setIsRefreshingLogs] = useState(false)

  const refreshLogs = async () => {
    setIsRefreshingLogs(true)
    try {
      setLogs(await getPlatformContainerLogsAction(containerId))
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

  return { logs, isRefreshingLogs, refreshLogs }
}

const useContainerActions = (container: PlatformContainerDetails['container']) => {
  const router = useRouter()
  const [pendingAction, setPendingAction] = useState<ContainerPendingAction | null>(null)
  const [isActing, setIsActing] = useState(false)
  const [forceRemove, setForceRemove] = useState(container.state === 'removing')

  const runAction = async () => {
    if (!pendingAction) {
      return
    }

    const actionRunners: Record<ContainerPendingAction, () => Promise<void>> = {
      stop: async () => {
        await stopPlatformContainerAction(container.id)
        toast({ title: 'Container stopped' })
        router.refresh()
      },
      remove: async () => {
        await removePlatformContainerAction(container.id, forceRemove)
        toast({ title: forceRemove ? 'Container force-removed' : 'Container removed' })
        router.push('/settings/orchestrator/containers')
      }
    }

    setIsActing(true)
    try {
      await actionRunners[pendingAction]()
      setPendingAction(null)
    } catch (error) {
      toast({
        title: actionDialogCopy[pendingAction].errorTitle,
        description: getDisplayErrorMessage(error),
        variant: 'destructive'
      })
    } finally {
      setIsActing(false)
    }
  }

  const closeActionDialog = (open: boolean) => {
    if (!open) {
      setPendingAction(null)
    }
  }

  return { pendingAction, isActing, forceRemove, setForceRemove, setPendingAction, runAction, closeActionDialog }
}

export const OrchestratorContainerDetail = ({
  details,
  initialLogs
}: {
  details: PlatformContainerDetails
  initialLogs: PlatformContainerLog
}) => {
  const container = details.container
  const relatedImage = details.relatedImage
  const { stats, statsError, isRefreshingStats, refreshStats } = useContainerStats(container)
  const { logs, isRefreshingLogs, refreshLogs } = useContainerLogs(container.id, initialLogs)
  const { pendingAction, isActing, forceRemove, setForceRemove, setPendingAction, runAction, closeActionDialog } =
    useContainerActions(container)

  return (
    <>
      <section className='flex w-full flex-col gap-6 px-6 pb-16 max-sm:px-4'>
        <ContainerOverviewSection
          container={container}
          onAction={setPendingAction}
        />

        <LiveResourcesSection
          containerState={container.state}
          stats={stats}
          statsError={statsError}
          isRefreshingStats={isRefreshingStats}
          onRefresh={() => void refreshStats()}
        />

        <div className='grid gap-6 xl:grid-cols-2'>
          <RelatedImageSection relatedImage={relatedImage} />
          <RelatedNetworksSection networks={details.relatedNetworks} />
        </div>

        <ContainerLogsSection
          logs={logs}
          isRefreshingLogs={isRefreshingLogs}
          onRefresh={() => void refreshLogs()}
        />

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

      <ContainerActionDialog
        containerState={container.state}
        forceRemove={forceRemove}
        isActing={isActing}
        pendingAction={pendingAction}
        onForceRemoveChange={setForceRemove}
        onOpenChange={closeActionDialog}
        onRunAction={() => void runAction()}
      />
    </>
  )
}
