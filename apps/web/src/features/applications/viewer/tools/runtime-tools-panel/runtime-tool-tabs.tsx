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
      className='scrollbar-thin flex w-full min-w-0 items-center gap-1 overflow-x-auto rounded-xl border border-border/60 bg-surface-band/28 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]'
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
          title={tool.description}
          onClick={() => onSelectTool(tool.id)}
          onKeyDown={event => handleToolTabKeyDown(event, tool.id)}
          className={cn(
            'group flex shrink-0 items-center gap-2 rounded-lg border border-transparent px-3.5 py-2 text-sm font-medium whitespace-nowrap text-foreground-muted transition-[color,background-color,border-color,box-shadow,transform] duration-150 hover:bg-surface-panel/55 hover:text-foreground active:scale-[0.98] focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none',
            {
              'border-border/65 bg-surface-panel text-foreground shadow-[0_8px_24px_-18px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.04)]':
                selectedToolId === tool.id
            }
          )}
        >
          <span
            className={cn(
              'flex size-6 items-center justify-center rounded-md text-foreground-muted transition-colors group-hover:text-foreground',
              selectedToolId === tool.id && 'bg-primary/10 text-primary'
            )}
          >
            <tool.Icon className='size-4' />
          </span>
          {tool.title}
        </button>
      ))}
    </div>
  )
}
