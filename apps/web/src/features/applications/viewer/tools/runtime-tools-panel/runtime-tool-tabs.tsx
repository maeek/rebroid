'use client'

import { TabsList, TabsRoot, TabsTrigger } from '@/components/ui/tabs'
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
  return (
    <TabsRoot
      idPrefix='runtime-tool'
      value={selectedToolId ?? ''}
      onValueChange={value => onSelectTool(value as RuntimeToolId)}
    >
      <TabsList
        ariaLabel='Runtime tools'
        variant='scrollable'
        className='w-full p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]'
      >
        {tools.map(tool => (
          <TabsTrigger
            key={tool.id}
            value={tool.id}
            className='group min-h-7 flex-none gap-1.5 px-2.5 py-1.5 text-xs'
          >
            <span
              className={cn(
                'flex size-5 items-center justify-center rounded-control text-foreground-muted transition-colors group-hover:text-foreground',
                selectedToolId === tool.id && 'bg-primary/10 text-primary'
              )}
            >
              <tool.Icon className='size-3.5' />
            </span>
            {tool.title}
          </TabsTrigger>
        ))}
      </TabsList>
    </TabsRoot>
  )
}
