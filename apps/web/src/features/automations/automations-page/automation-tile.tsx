import { IconClock, IconListCheck, IconPlayerPlay, IconRobot } from '@tabler/icons-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import type { Automation } from '@/server/orchestrator/automations/types'

const statusVariant = (status: Automation['lastStatus']) => (status === 'failed' ? 'destructive' : 'secondary')

const formatDate = (value: string | null) => {
  if (!value) return 'Never run'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}

export function AutomationTile({ automation }: { automation: Automation }) {
  const stepCount = automation.definition.spec.steps.length

  return (
    <Link href={`/automations/${automation.id}`}>
      <article className='grid h-full min-h-48 gap-4 rounded-lg border border-border/70 bg-card/35 p-4 transition hover:border-primary/35 hover:bg-card/50'>
        <div className='flex items-start gap-3'>
          <div className='flex size-11 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary'>
            <IconRobot className='size-6' />
          </div>
          <div className='min-w-0'>
            <h3 className='truncate font-medium'>{automation.name}</h3>
            <p className='mt-1 line-clamp-2 text-sm text-secondary-foreground'>
              {automation.description || 'No description'}
            </p>
          </div>
        </div>

        <div className='grid gap-2 text-xs text-secondary-foreground'>
          <span className='flex items-center gap-2'>
            <IconListCheck className='size-4 shrink-0' />
            {stepCount} {stepCount === 1 ? 'step' : 'steps'}
          </span>
          <span className='flex items-center gap-2'>
            <IconClock className='size-4 shrink-0' />
            {formatDate(automation.lastRunAt)}
          </span>
        </div>

        <div className='flex flex-wrap items-center justify-between gap-2'>
          <Badge
            variant={statusVariant(automation.lastStatus)}
            className='text-[10px] capitalize'
          >
            {automation.lastStatus.replace(/_/g, ' ')}
          </Badge>
          <span className='inline-flex items-center gap-1 text-xs text-primary'>
            <IconPlayerPlay className='size-3.5' />
            Open
          </span>
        </div>
      </article>
    </Link>
  )
}
