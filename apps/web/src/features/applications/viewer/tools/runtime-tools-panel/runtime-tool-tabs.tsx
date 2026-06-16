'use client'

import type { KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'
import type { RuntimeToolDefinition, RuntimeToolId } from './runtime-tool-definitions'

export const RuntimeToolTabs = ({
  onSelectTool,
  selectedToolId,
  tools
}: {
  onSelectTool: (toolId: RuntimeToolId) => void
  selectedToolId: RuntimeToolId | null
  tools: RuntimeToolDefinition[]
}) => {
  const handleToolTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, toolId: RuntimeToolId) => {
    const currentIndex = tools.findIndex(tool => tool.id === toolId)
    if (currentIndex === -1) return

    const keyToIndex: Record<string, number> = {
      ArrowLeft: currentIndex - 1,
      ArrowRight: currentIndex + 1,
      Home: 0,
      End: tools.length - 1
    }
    const nextIndex = keyToIndex[event.key]

    if (nextIndex === undefined) return

    event.preventDefault()
    const nextTool = tools[(nextIndex + tools.length) % tools.length]
    onSelectTool(nextTool.id)
    document.getElementById(`runtime-tool-tab-${nextTool.id}`)?.focus()
  }

  return (
    <div
      role='tablist'
      aria-label='Runtime tools'
      className='flex w-full min-w-0 items-center gap-1 overflow-x-auto scrollbar-thin py-1 px-1.5 rounded-md bg-surface-band/40 border border-border/70'
    >
      {tools.map(tool => (
        <button
          key={tool.id}
          type='button'
          id={`runtime-tool-tab-${tool.id}`}
          role='tab'
          aria-selected={selectedToolId === tool.id}
          aria-controls={`runtime-tool-panel-${tool.id}`}
          tabIndex={selectedToolId === tool.id ? 0 : -1}
          onClick={() => onSelectTool(tool.id)}
          onKeyDown={event => handleToolTabKeyDown(event, tool.id)}
          className={cn(
            'flex shrink-0 items-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors hover:bg-primary/8 hover:text-primary focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none',
            {
              'bg-primary/10 text-foreground': selectedToolId === tool.id
            }
          )}
        >
          <tool.Icon className={cn('size-5', { 'text-primary': selectedToolId === tool.id })} />
          {tool.title}
        </button>
      ))}
    </div>
  )
}
