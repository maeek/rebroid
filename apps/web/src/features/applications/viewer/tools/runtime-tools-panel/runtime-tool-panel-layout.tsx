import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { runtimeToolPanelClassName, type RuntimeToolId } from './runtime-tool-definitions'

export const RuntimeToolPanelLayout = ({ toolId, children }: { toolId: RuntimeToolId; children: ReactNode }) => (
  <div className='flex min-h-0 w-full flex-1 flex-col'>
    <div className='flex min-h-0 flex-1 flex-col overflow-hidden'>
      <div
        id={`runtime-tool-panel-${toolId}`}
        aria-label={toolId}
        className={cn('min-h-0', toolId === 'files' && 'py-4', runtimeToolPanelClassName(toolId))}
      >
        {children}
      </div>
    </div>
  </div>
)
