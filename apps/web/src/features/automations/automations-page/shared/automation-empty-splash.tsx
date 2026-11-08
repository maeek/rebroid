import { IconCalendarTime, IconDeviceMobileCog, IconPlus, IconRobot } from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

type AutomationEmptySplashVariant = 'automations' | 'triggers' | 'trigger-prerequisites'

const copy = {
  automations: {
    title: 'No workflows yet',
    description: 'Create your first Android automation workflow, then run it manually or attach it to a trigger.',
    action: 'New workflow',
    href: '/automations/create'
  },
  triggers: {
    title: 'No triggers yet',
    description: 'Create a trigger to run a workflow against an app profile on a schedule.',
    action: 'New trigger',
    href: null
  },
  'trigger-prerequisites': {
    title: 'No trigger target yet',
    description: 'Create a workflow and an app, then connect them with a scheduled trigger.',
    action: 'New workflow',
    href: '/automations/create'
  }
} satisfies Record<
  AutomationEmptySplashVariant,
  { title: string; description: string; action: string; href: string | null }
>

const icons = {
  automations: IconRobot,
  triggers: IconCalendarTime,
  'trigger-prerequisites': IconRobot
} satisfies Record<AutomationEmptySplashVariant, typeof IconRobot>

export function AutomationEmptySplash({
  onAction,
  variant
}: {
  onAction?: () => void
  variant: AutomationEmptySplashVariant
}) {
  const Icon = icons[variant]
  const content = copy[variant]

  return (
    <div className='px-6 py-12 max-sm:px-4'>
      <div className='flex min-h-[50vh] items-center justify-center px-8 py-12'>
        <div className='flex max-w-lg flex-col items-center gap-6 text-center'>
          <div className='relative flex size-28 items-center justify-center'>
            <div className='absolute inset-0 rounded-full bg-primary/10' />
            <div className='absolute size-20 rounded-full bg-surface-band/80' />
            <Icon className='relative size-12 text-primary' />
            <IconDeviceMobileCog className='absolute -right-1 bottom-3 size-8 text-foreground-muted' />
          </div>
          <div className='flex flex-col gap-2'>
            <h3 className='text-2xl font-medium'>{content.title}</h3>
            <p className='text-foreground-muted'>{content.description}</p>
          </div>
          {content.href ? (
            <Button asChild>
              <Link href={content.href}>
                <IconPlus className='size-4' />
                {content.action}
              </Link>
            </Button>
          ) : (
            <Button
              type='button'
              onClick={onAction}
            >
              <IconPlus className='size-4' />
              {content.action}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
