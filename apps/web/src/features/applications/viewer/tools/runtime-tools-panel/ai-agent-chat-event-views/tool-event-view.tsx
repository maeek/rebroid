import { IconChevronDown } from '@tabler/icons-react'
import type { ToolTimelineItem } from '../ai-agent-chat-event-utils'

type ToolEventRowValue = {
  key: string
  value: string | number | boolean | null | undefined
  format?: 'inline' | 'pre'
}

const ToolEventRow = ({ item }: { item: ToolEventRowValue }) => {
  const isPre = item.format === 'pre'
  const valueText =
    typeof item.value === 'string'
      ? item.value
      : item.value === null || item.value === undefined
        ? ''
        : typeof item.value === 'object'
          ? JSON.stringify(item.value) ?? String(item.value)
          : String(item.value)

  return (
    <div className='grid min-w-0 gap-0.5 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-2'>
      <dt className='min-w-0 font-medium text-muted-foreground'>{item.key}</dt>
      {isPre ? (
        <dd className='min-w-0'>
          <pre className='overflow-auto whitespace-pre-wrap rounded-sm bg-background/20 p-1 font-mono text-[11px] break-all text-muted-foreground/90'>
            {valueText}
          </pre>
        </dd>
      ) : (
        <dd className='min-w-0 overflow-hidden wrap-anywhere'>{valueText}</dd>
      )}
    </div>
  )
}

export const ToolEventView = ({ item }: { item: ToolTimelineItem }) => {
  const label = item.status === 'failed' ? 'Tool failed' : item.status === 'used' ? 'Used tool' : 'Using tool'
  const hasArguments = item.arguments.length > 0
  const hasOutput = item.output.length > 0

  return (
    <div className='grid gap-1 text-xs text-muted-foreground'>
      <details className='group'>
        <summary className='flex cursor-pointer list-none items-center gap-1'>
          <span>{label}</span>
          <span>({item.name})</span>
          {hasArguments || hasOutput ? (
            <IconChevronDown className='size-3 transition-transform group-open:rotate-180' />
          ) : null}
        </summary>
        {hasArguments ? (
          <dl className='mt-1 grid max-w-full gap-1 rounded-md bg-background/25 p-2 text-[11px] text-muted-foreground/80'>
            {item.arguments.map(argument => (
              <ToolEventRow
                key={argument.key}
                item={argument}
              />
            ))}
          </dl>
        ) : null}
        {hasOutput ? (
          <dl className='mt-1 grid max-w-full gap-1 rounded-md bg-background/25 p-2 text-[11px] text-muted-foreground/80'>
            {item.output.map(output => (
              <ToolEventRow
                key={output.key}
                item={output}
              />
            ))}
          </dl>
        ) : null}
      </details>
      {item.error ? <div className='wrap-anywhere text-destructive/85'>{item.error}</div> : null}
    </div>
  )
}
