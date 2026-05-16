'use client'

import { useState } from 'react'
import { IconBox, IconBoxMultiple, IconDatabase, IconRecycle, IconTopologyStar3 } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Section } from '@/components/ui/section'
import { toast } from '@/hooks/use-toast'
import {
  pruneAllDockerResourcesAction,
  pruneContainersAction,
  pruneImagesAction,
  pruneNetworksAction,
  pruneVolumesAction
} from '@/lib/orchestrator/actions'
import type { DockerPruneResponse } from '@/lib/orchestrator/types'

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
    <div className='flex flex-col gap-3 rounded-md border border-input bg-card/40 p-4'>
      <div className='flex items-start gap-3'>
        <div className='rounded-md border border-input bg-background/60 p-2 text-secondary-foreground'>{icon}</div>
        <div className='flex flex-col gap-1'>
          <h3 className='font-medium text-foreground'>{title}</h3>
          <p className='text-sm text-secondary-foreground'>{description}</p>
        </div>
      </div>
      <Button
        variant='secondary'
        disabled={isBusy}
        onClick={onClick}
      >
        {actionLabel}
      </Button>
    </div>
  )
}

export const OrchestratorMaintenanceSection = ({
  imagePruneDanglingOnly,
  onMaintenanceComplete
}: {
  imagePruneDanglingOnly: boolean
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
      toast({ title: successTitle, description: successDescription(result) })
      onMaintenanceComplete?.()
    } catch (error) {
      toast({
        title: `Could not ${successTitle.toLowerCase()}`,
        description: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setActiveAction(null)
    }
  }

  return (
    <Section
      title='Maintenance'
      boxed
      contentClassName='gap-4'
      className='w-full'
    >
      <p className='text-sm text-secondary-foreground'>
        Run one-off Docker cleanup tasks without leaving settings. Use the prune mode below to control image cleanup
        defaults.
      </p>
      <div className='grid gap-3'>
        <MaintenanceActionCard
          title='Prune images'
          description={
            imagePruneDanglingOnly
              ? 'Removes dangling images using the current safer cleanup mode.'
              : 'Removes all unused images using the current cleanup mode.'
          }
          icon={<IconBox className='size-5' />}
          actionLabel={imagePruneDanglingOnly ? 'Prune dangling images' : 'Prune unused images'}
          isBusy={activeAction !== null}
          onClick={() =>
            void runMaintenanceAction({
              action: () => pruneImagesAction(imagePruneDanglingOnly),
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
          actionLabel='Prune stopped containers'
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
          actionLabel='Prune unused networks'
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
          actionLabel='Prune unused volumes'
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
      <div className='rounded-md border border-primary/20 bg-primary/8 p-4'>
        <div className='flex items-start gap-3'>
          <div className='rounded-md border border-primary/20 bg-background/60 p-2 text-primary'>
            <IconRecycle className='size-5' />
          </div>
          <div className='flex flex-col gap-3'>
            <div>
              <h3 className='font-medium text-foreground'>Full cleanup</h3>
              <p className='text-sm text-secondary-foreground'>
                Prunes stopped containers, unused networks, dangling images, and unused volumes in one pass.
              </p>
            </div>
            <Button
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
              Run full cleanup
            </Button>
          </div>
        </div>
      </div>
    </Section>
  )
}
