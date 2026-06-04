import { IconCalendarTime, IconDeviceMobileCog, IconPlus, IconRobot } from '@tabler/icons-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'

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
    description: 'Create a trigger to run an automation against an app profile on a schedule.',
    action: 'New trigger',
    href: null
  },
  'trigger-prerequisites': {
    title: 'No trigger target yet',
    description: 'Create an automation first, then connect it to an app profile with a trigger.',
    action: 'Create automation',
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
  const action = (
    <Badge
      variant='status'
      className='gap-2 px-4 py-2 text-sm hover:bg-primary/20'
    >
      <IconPlus className='size-4' />
      {content.action}
    </Badge>
  )

  return (
    <div className='px-6 py-12 max-sm:px-4'>
      <div className='flex min-h-[50vh] items-center justify-center px-8 py-12'>
        <div className='flex max-w-lg flex-col items-center gap-6 text-center'>
          <div className='relative flex size-28 items-center justify-center'>
            <div className='absolute inset-0 rounded-full bg-primary/10' />
            <div className='absolute size-20 rounded-full bg-secondary/80' />
            <Icon className='relative size-12 text-primary' />
            <IconDeviceMobileCog className='absolute -right-1 bottom-3 size-8 text-secondary-foreground' />
          </div>
          <div className='flex flex-col gap-2'>
            <h3 className='text-2xl font-medium'>{content.title}</h3>
            <p className='text-secondary-foreground'>{content.description}</p>
          </div>
          {content.href ? (
            <Link href={content.href}>{action}</Link>
          ) : (
            <button
              type='button'
              className='appearance-none border-0 bg-transparent p-0'
              onClick={onAction}
            >
              {action}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
