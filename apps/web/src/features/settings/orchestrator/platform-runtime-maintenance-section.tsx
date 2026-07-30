'use client'

import { useState } from 'react'
import {
  IconBox,
  IconBoxMultiple,
  IconDatabase,
  IconPackage,
  IconRecycle,
  IconTopologyStar3
} from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Section } from '@/components/ui/section'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import {
  pruneAllDockerResourcesAction,
  pruneContainersAction,
  pruneImagesAction,
  pruneNetworksAction,
  pruneVolumesAction
} from '@/server/orchestrator/docker-maintenance/actions'
import { cleanupUploadedApksAction } from '@/server/orchestrator/settings/actions'
import { isActionResult, unwrapActionResult } from '@/shared/actions/action-result'
import type { CleanupUploadedApksResponse } from '@/shared/contracts/application'
import type { DockerPruneResponse } from '@/shared/contracts/docker-maintenance'

const formatBytes = (bytes?: number) => {
  if (!bytes) {
    return null
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** index).toFixed(2)} ${units[index]}`
}

const summarizePruneResult = (result: DockerPruneResponse, label: string) => {
  const deletedCount =
    result.ContainersDeleted?.length ??
    result.ImagesDeleted?.length ??
    result.NetworksDeleted?.length ??
    result.VolumesDeleted?.length ??
    0
  const reclaimed = formatBytes(result.SpaceReclaimed)

  return reclaimed
    ? `${label} completed. Removed ${deletedCount} items and reclaimed ${reclaimed}.`
    : `${label} completed. Removed ${deletedCount} items.`
}

const MaintenanceActionCard = ({
  title,
  description,
  icon,
  actionLabel,
  isBusy,
  onClick
}: {
  title: string
  description: string
  icon: React.ReactNode
  actionLabel: string
  isBusy: boolean
  onClick: () => void
}) => {
  return (
    <div className='flex w-full items-center justify-between gap-4 rounded-panel border border-surface-border/70 bg-surface-band/55 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] max-sm:flex-col max-sm:items-stretch'>
      <div className='flex min-w-0 items-start gap-3'>
        <div className='rounded-control bg-danger/10 p-2 text-danger'>{icon}</div>
        <div className='flex flex-col gap-1'>
          <h3 className='font-medium text-foreground'>{title}</h3>
          <p className='text-sm leading-5 text-foreground-muted'>{description}</p>
        </div>
      </div>
      <Button
        variant='danger'
        className='shrink-0 max-sm:w-full'
        disabled={isBusy}
        onClick={onClick}
      >
        {actionLabel}
      </Button>
    </div>
  )
}

export const PlatformRuntimeMaintenanceSection = ({
  onMaintenanceComplete
}: {
  onMaintenanceComplete?: () => void
}) => {
  const [activeAction, setActiveAction] = useState<string | null>(null)

  const runMaintenanceAction = async ({
    action,
    key,
    successTitle,
    successDescription
  }: {
    action: () => Promise<unknown>
    key: string
    successTitle: string
    successDescription: (result: unknown) => string
  }) => {
    setActiveAction(key)

    try {
      const result = await action()
      const data = isActionResult(result) ? unwrapActionResult(result) : result
      toast({ title: successTitle, description: successDescription(data) })
      onMaintenanceComplete?.()
    } catch (error) {
      toast({
        title: `Could not ${successTitle.toLowerCase()}`,
        description: getDisplayErrorMessage(error),
        variant: 'danger'
      })
    } finally {
      setActiveAction(null)
    }
  }

  return (
    <Section
      surface='plain'
      title='Maintenance'
      headingSpacing='default'
      contentClassName='gap-4'
      className='w-full'
    >
      <p className='text-sm text-foreground-muted'>
        Run one-off Docker cleanup tasks without leaving settings. Recurring cleanup is managed from Scheduler.
      </p>
      <div className='grid gap-3'>
        <MaintenanceActionCard
          title='Clean APK uploads'
          description='Removes uploaded APK records and files that are not referenced by any Android application.'
          icon={<IconPackage className='size-5' />}
          actionLabel='Clean'
          isBusy={activeAction !== null}
          onClick={() =>
            void runMaintenanceAction({
              action: cleanupUploadedApksAction,
              key: 'apks',
              successTitle: 'APK uploads cleaned',
              successDescription: result => {
                const cleanup = result as CleanupUploadedApksResponse
                return `Removed ${cleanup.deletedRecords} upload records and ${cleanup.removedFiles} files.`
              }
            })
          }
        />
        <MaintenanceActionCard
          title='Prune images'
          description='Removes dangling images. Use Scheduler to configure recurring image cleanup mode.'
          icon={<IconBox className='size-5' />}
          actionLabel='Prune'
          isBusy={activeAction !== null}
          onClick={() =>
            void runMaintenanceAction({
              action: () => pruneImagesAction(true),
              key: 'images',
              successTitle: 'Images pruned',
              successDescription: result => summarizePruneResult(result as DockerPruneResponse, 'Image prune')
            })
          }
        />
        <MaintenanceActionCard
          title='Prune containers'
          description='Removes stopped containers that are no longer in use.'
          icon={<IconBoxMultiple className='size-5' />}
          actionLabel='Prune'
          isBusy={activeAction !== null}
          onClick={() =>
            void runMaintenanceAction({
              action: pruneContainersAction,
              key: 'containers',
              successTitle: 'Containers pruned',
              successDescription: result => summarizePruneResult(result as DockerPruneResponse, 'Container prune')
            })
          }
        />
        <MaintenanceActionCard
          title='Prune networks'
          description='Removes unused Docker networks that are no longer attached to active containers.'
          icon={<IconTopologyStar3 className='size-5' />}
          actionLabel='Prune'
          isBusy={activeAction !== null}
          onClick={() =>
            void runMaintenanceAction({
              action: pruneNetworksAction,
              key: 'networks',
              successTitle: 'Networks pruned',
              successDescription: result => summarizePruneResult(result as DockerPruneResponse, 'Network prune')
            })
          }
        />
        <MaintenanceActionCard
          title='Prune volumes'
          description='Removes unused volumes that are no longer mounted by managed containers.'
          icon={<IconDatabase className='size-5' />}
          actionLabel='Prune'
          isBusy={activeAction !== null}
          onClick={() =>
            void runMaintenanceAction({
              action: pruneVolumesAction,
              key: 'volumes',
              successTitle: 'Volumes pruned',
              successDescription: result => summarizePruneResult(result as DockerPruneResponse, 'Volume prune')
            })
          }
        />
      </div>
      <div className='rounded-control bg-danger/10 p-4 text-foreground'>
        <div className='flex items-center justify-between gap-4 max-sm:flex-col max-sm:items-stretch'>
          <div className='flex min-w-0 items-start gap-3'>
            <div className='rounded-control bg-surface-band/60 p-2 text-danger'>
              <IconRecycle className='size-5' />
            </div>
            <div>
              <h3 className='font-medium text-foreground'>Full cleanup</h3>
              <p className='text-sm leading-5 text-foreground-muted'>
                Prunes stopped containers, unused networks, dangling images, and unused volumes in one pass.
              </p>
            </div>
          </div>
          <Button
            className='shrink-0 max-sm:w-full'
            variant='danger'
            disabled={activeAction !== null}
            onClick={() =>
              void runMaintenanceAction({
                action: pruneAllDockerResourcesAction,
                key: 'all',
                successTitle: 'Full cleanup completed',
                successDescription: () =>
                  'Stopped containers, unused networks, dangling images, and unused volumes were pruned.'
              })
            }
          >
            Full cleanup
          </Button>
        </div>
      </div>
    </Section>
  )
}
