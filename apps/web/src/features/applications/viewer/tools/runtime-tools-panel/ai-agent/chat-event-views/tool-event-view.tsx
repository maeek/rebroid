import { IconAlertTriangle, IconCheck, IconChevronDown, IconLoader2, IconTool } from '@tabler/icons-react'
import { cn } from '@/lib/utils'
import { AiToolDetails } from '@/shared/ui/ai/ai-message'
import type { ToolTimelineItem } from '../ai-agent-chat-event-utils'

type ToolEventRowValue = {
  key: string
  value: string | number | boolean | null | undefined
  format?: 'inline' | 'pre'
}

export const ToolEventRow = ({ item }: { item: ToolEventRowValue }) => {
  const isPre = item.format === 'pre'
  const valueText =
    typeof item.value === 'string'
      ? item.value
      : item.value === null || item.value === undefined
        ? ''
        : typeof item.value === 'object'
          ? (JSON.stringify(item.value) ?? String(item.value))
          : String(item.value)

  return (
    <div className='grid min-w-0 gap-0.5 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-2'>
      <dt className='min-w-0 font-medium text-muted-foreground'>{item.key}</dt>
      {isPre ? (
        <dd className='min-w-0'>
          <pre className='max-h-72 overflow-auto whitespace-pre-wrap rounded-sm bg-background/20 p-1 font-mono text-[11px] break-all text-muted-foreground/90'>
            {valueText}
          </pre>
        </dd>
      ) : (
        <dd className='min-w-0 overflow-hidden wrap-anywhere whitespace-pre-wrap'>{valueText}</dd>
      )}
    </div>
  )
}

export const ToolEventView = ({ item }: { item: ToolTimelineItem }) => {
  const label = item.status === 'failed' ? 'Tool failed' : item.status === 'used' ? 'Tool completed' : 'Using tool'
  const hasArguments = item.arguments.length > 0
  const hasOutput = item.output.length > 0

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border bg-surface-band/24 transition-[border-color,background-color] duration-150',
        item.status === 'failed' ? 'border-destructive/30 bg-destructive/5' : 'border-border/55'
      )}
    >
      <details className='group'>
        <summary className='flex cursor-pointer list-none items-center gap-2.5 px-3 py-2.5 text-xs text-foreground-muted transition-colors hover:bg-foreground/3'>
          <span
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-lg border',
              item.status === 'failed'
                ? 'border-destructive/25 bg-destructive/8 text-destructive'
                : item.status === 'used'
                  ? 'border-success/25 bg-success/10 text-success'
                  : 'border-primary/20 bg-primary/8 text-primary'
            )}
          >
            {item.status === 'failed' ? (
              <IconAlertTriangle className='size-4' />
            ) : item.status === 'used' ? (
              <IconCheck className='size-4' />
            ) : (
              <IconLoader2 className='size-4 motion-safe:animate-spin' />
            )}
          </span>
          <span className='grid min-w-0 flex-1 text-left'>
            <span className='font-medium text-foreground'>{label}</span>
            <span className='truncate font-mono text-[10px]'>{item.name}</span>
          </span>
          {hasArguments || hasOutput ? (
            <IconChevronDown className='size-3.5 transition-transform duration-150 group-open:rotate-180' />
          ) : (
            <IconTool className='size-3.5 opacity-50' />
          )}
        </summary>
        <div className='grid gap-2 px-3 pb-3'>
          {hasArguments ? (
            <div className='grid gap-1'>
              <span className='text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground-muted'>Input</span>
              <AiToolDetails>
                {item.arguments.map(argument => (
                  <ToolEventRow
                    key={argument.key}
                    item={argument}
                  />
                ))}
              </AiToolDetails>
            </div>
          ) : null}
          {hasOutput ? (
            <div className='grid gap-1'>
              <span className='text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground-muted'>
                Result
              </span>
              <AiToolDetails>
                {item.output.map(output => (
                  <ToolEventRow
                    key={output.key}
                    item={output}
                  />
                ))}
              </AiToolDetails>
            </div>
          ) : null}
        </div>
      </details>
      {item.error ? (
        <div className='wrap-anywhere border-t border-destructive/15 px-3 py-2 text-xs text-destructive/90'>
          {item.error}
        </div>
      ) : null}
    </div>
  )
}
