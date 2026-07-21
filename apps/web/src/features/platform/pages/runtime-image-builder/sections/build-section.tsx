import { IconHammer, IconLoader2, IconPlayerStop, IconPlus } from '@tabler/icons-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Section } from '@/components/ui/section'
import { Visible } from '@/components/ui/visible'
import type { ContainerImageBuildJob } from '@/shared/contracts/platform'

type BuildSectionProps = {
  activeJob: ContainerImageBuildJob | null
  canStart: boolean
  isActiveJobRunning: boolean
  isStarting: boolean
  onCancelBuild: () => void
  onSetAsDefault: () => void
  onStartBuild: () => void
}

export const BuildSection = ({
  activeJob,
  canStart,
  isActiveJobRunning,
  isStarting,
  onCancelBuild,
  onSetAsDefault,
  onStartBuild
}: BuildSectionProps) => (
  <Section
    surface='plain'
    title='Build'
    contentClassName='gap-4'
  >
    <div className='flex flex-wrap items-center gap-2'>
      <Button
        type='button'
        disabled={!canStart}
        onClick={onStartBuild}
      >
        {isStarting ? <IconLoader2 className='size-4 animate-spin' /> : <IconHammer />}
        Build image
      </Button>
      <Button
        type='button'
        variant='secondary'
        disabled={!isActiveJobRunning}
        onClick={onCancelBuild}
      >
        <IconPlayerStop className='size-4' />
        Cancel
      </Button>
      <Visible when={activeJob?.status === 'succeeded'}>
        <Button
          type='button'
          variant='primary'
          onClick={onSetAsDefault}
        >
          Use as default
        </Button>
        <Button
          asChild
          variant='secondary'
        >
          <Link href={`/apps/create?${new URLSearchParams({ image: activeJob?.targetImage ?? '' }).toString()}`}>
            <IconPlus className='size-4' />
            Create app
          </Link>
        </Button>
      </Visible>
    </div>
    {activeJob ? (
      <div className='flex flex-wrap items-center gap-2 text-sm text-foreground-muted'>
        <Badge
          variant={activeJob.status === 'succeeded' ? 'success' : activeJob.status === 'failed' ? 'danger' : 'neutral'}
        >
          {activeJob.status}
        </Badge>
        <span className='font-mono'>{activeJob.targetImage}</span>
        {activeJob.imageId ? <span className='font-mono'>{activeJob.imageId.slice(0, 18)}</span> : null}
      </div>
    ) : null}
    <pre className='max-h-[28rem] min-h-48 overflow-auto rounded-control border border-surface-border/60 bg-surface-band/35 p-3 text-xs leading-5 text-foreground-muted'>
      {activeJob?.logTail ?? 'No build has been started.'}
    </pre>
  </Section>
)
