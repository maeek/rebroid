import type { ComponentType } from 'react'
import { IconFolder, IconRobot } from '@tabler/icons-react'
import { GradientSparklesIcon } from '@/components/icons/gradient-sparkles-icon'
import { hasPermission, type PermissionMap } from '@/shared/permissions/permissions'

export type RuntimeToolId = 'files' | 'ai-agent' | 'workflows'
export interface RuntimeToolDefinition {
  id: RuntimeToolId
  title: string
  description: string
  Icon: ComponentType<{ className?: string }>
}
export const runtimeInlineSectionClassName = 'rounded-none border-0 bg-transparent p-0 shadow-none backdrop-blur-none'
export const runtimeToolPanelClassName = (toolId: RuntimeToolId | null) =>
  toolId === 'ai-agent' ? 'flex h-[36rem] flex-col overflow-hidden lg:h-full' : 'overflow-auto'

export const getRuntimeTools = ({ permissions }: { permissions: PermissionMap }): RuntimeToolDefinition[] => {
  const tools: RuntimeToolDefinition[] = []
  if (hasPermission(permissions, 'automations:run') && hasPermission(permissions, 'automations:run-ai')) {
    tools.push({ id: 'ai-agent', title: 'AI agent', description: 'Run AI-assisted tasks', Icon: GradientSparklesIcon })
  }
  if (hasPermission(permissions, 'automations:run')) {
    tools.push({ id: 'workflows', title: 'Workflows', description: 'Run workflows for this app', Icon: IconRobot })
  }
  if (hasPermission(permissions, 'applications:transfer-files')) {
    tools.push({ id: 'files', title: 'Files', description: 'Manage device files', Icon: IconFolder })
  }
  return tools
}
