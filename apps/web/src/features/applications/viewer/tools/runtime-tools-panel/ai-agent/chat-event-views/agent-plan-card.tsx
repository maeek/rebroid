import { IconCheck, IconCircle, IconListCheck, IconLoader2 } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { AgentPlanStep } from '../ai-agent-chat-presentation'

export const AgentPlanCard = ({ steps, updated }: { steps: AgentPlanStep[]; updated: boolean }) => {
  if (steps.length === 0) return null
  const completed = steps.filter(step => step.status === 'completed').length
  return (
    <section
      aria-label='Agent task plan'
      className='overflow-hidden rounded-panel border border-surface-border/65 bg-surface-band/28 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]'
    >
      <div className='flex items-center justify-between gap-3 border-b border-surface-border/50 px-3 py-2.5'>
        <div className='flex min-w-0 items-center gap-2'>
          <span className='flex size-7 shrink-0 items-center justify-center rounded-panel bg-primary/10 text-primary'>
            <IconListCheck className='size-4' />
          </span>
          <div className='min-w-0'>
            <div className='text-xs font-medium text-foreground'>{updated ? 'Updated plan' : 'Task plan'}</div>
            <div className='text-xs text-foreground-muted'>{steps.length} verifiable steps</div>
          </div>
        </div>
        <Badge
          variant={completed === steps.length ? 'success' : 'neutral'}
          className='shrink-0 font-medium tabular-nums'
        >
          {completed}/{steps.length}
        </Badge>
      </div>
      <ol className='grid px-3 py-2'>
        {steps.map((step, index) => (
          <li
            key={step.id}
            className={cn(
              'relative grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2 py-2 text-xs',
              index < steps.length - 1
                ? "after:absolute after:top-8 after:bottom-[-0.5rem] after:left-[0.72rem] after:w-px after:bg-border/65 after:content-['']"
                : ''
            )}
          >
            <span
              className={cn(
                'relative z-10 flex size-6 items-center justify-center rounded-full border bg-background',
                step.status === 'completed'
                  ? 'border-success/35 bg-success/12 text-success'
                  : step.status === 'active'
                    ? 'border-primary/40 bg-primary/12 text-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.06)]'
                    : 'border-surface-border/75 text-foreground-muted'
              )}
            >
              {step.status === 'completed' ? (
                <IconCheck className='size-3.5' />
              ) : step.status === 'active' ? (
                <IconLoader2 className='size-3.5 motion-safe:animate-spin' />
              ) : (
                <IconCircle className='size-2.5' />
              )}
            </span>
            <div className='min-w-0 pt-0.5'>
              <p
                className={cn(
                  'leading-5',
                  step.status === 'completed'
                    ? 'text-foreground-muted line-through decoration-border'
                    : 'text-foreground'
                )}
              >
                {step.label}
              </p>
              {step.evidence ? <p className='mt-0.5 text-xs leading-4 text-foreground-muted'>{step.evidence}</p> : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
