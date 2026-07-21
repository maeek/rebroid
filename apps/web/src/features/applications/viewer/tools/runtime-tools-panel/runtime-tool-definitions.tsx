import type { ComponentType } from 'react'
import { IconCast, IconClipboard, IconFolder, IconLogs, IconRobot, IconWorld } from '@tabler/icons-react'
import { GradientSparklesIcon } from '@/components/icons/gradient-sparkles-icon'
import { hasPermission, type PermissionMap } from '@/shared/permissions/permissions'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { ViewerSettings } from '@/features/applications/viewer/settings/viewer-settings'
import type { AutomationRun } from '@/shared/contracts/automation'

export type RuntimeToolId = 'clipboard' | 'files' | 'streaming' | 'network-access' | 'logs' | 'ai-agent' | 'workflows'

export interface RuntimeToolDefinition {
  id: RuntimeToolId
  title: string
  description: string
  Icon: ComponentType<{ className?: string }>
}

export const runtimeInlineSectionClassName = 'rounded-none border-0 bg-transparent p-0 shadow-none backdrop-blur-none'

export const runtimeToolPanelClassName = (toolId: RuntimeToolId | null) =>
  toolId === 'ai-agent'
    ? 'flex h-[min(70dvh,36rem)] max-h-[36rem] flex-1 flex-col overflow-hidden md:h-[calc(100dvh-18rem)] md:max-h-none lg:h-[calc(100dvh-16rem)]'
    : 'overflow-auto'

export const getRuntimeTools = ({
  app,
  latestAutomationRun,
  permissions,
  viewerSettings
}: {
  app: AppDefinition
  latestAutomationRun: AutomationRun | null
  permissions: PermissionMap
  viewerSettings: ViewerSettings
}): RuntimeToolDefinition[] => {
  const tools: Array<RuntimeToolDefinition | null> = [
    hasPermission(permissions, 'automations:run') && hasPermission(permissions, 'automations:run-ai')
      ? {
          id: 'ai-agent' as const,
          title: 'AI agent',
          description: app.running
            ? 'Run ad-hoc workflows with AI assistance'
            : 'History and settings remain available while stopped',
          Icon: GradientSparklesIcon
        }
      : null,
    hasPermission(permissions, 'automations:run')
      ? {
          id: 'workflows' as const,
          title: 'Workflows',
          description: latestAutomationRun ? `Run ${latestAutomationRun.id.slice(0, 8)}` : 'Active runs',
          Icon: IconRobot
        }
      : null,
    hasPermission(permissions, 'applications:sync-clipboard') && app.running
      ? {
          id: 'clipboard' as const,
          title: 'Clipboard',
          description: 'Pull or push text',
          Icon: IconClipboard
        }
      : null,
    {
      id: 'streaming' as const,
      title: 'Streaming',
      description: `${viewerSettings.transport.toUpperCase()} • ${viewerSettings.bitrateMbps} Mbps`,
      Icon: IconCast
    },
    hasPermission(permissions, 'applications:configure-egress')
      ? {
          id: 'network-access' as const,
          title: 'Network access',
          description: app.networkPolicyEnabled ? 'Restricted outbound access' : 'Unrestricted outbound access',
          Icon: IconWorld
        }
      : null,
    hasPermission(permissions, 'applications:transfer-files') && app.running
      ? {
          id: 'files' as const,
          title: 'Files',
          description: 'Upload and download files',
          Icon: IconFolder
        }
      : null,
    hasPermission(permissions, 'applications:view-logs') && app.running
      ? {
          id: 'logs' as const,
          title: 'Logs',
          description: 'View application logs',
          Icon: IconLogs
        }
      : null
  ]

  return tools.filter((tool): tool is RuntimeToolDefinition => Boolean(tool))
}
