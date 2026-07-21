import { AppLogsContent } from '@/features/applications/viewer/logs/app-logs-content'
import { cn } from '@/lib/utils'
import { draftWorkflowFromAdHocRunAction } from '@/server/orchestrator/automations/automation-management-actions'
import { suggestAdHocAiPromptsAction } from '@/server/orchestrator/automations/automation-run-actions'
import { hasPermission, type PermissionMap } from '@/shared/permissions/permissions'
import { AiAgentToolsSection } from './ai-agent/ai-agent-tools-section'
import { ClipboardToolsSection } from './clipboard/clipboard-tools-section'
import { DownloadsToolsSection } from './files/downloads-tools-section'
import { NetworkAccessToolsSection } from './network-access/network-access-tools-section'
import { runtimeInlineSectionClassName, type RuntimeToolId } from './runtime-tool-definitions'
import { StreamingToolsSection } from './streaming/streaming-tools-section'
import { AutomationStatusToolsSection } from './workflows/automation-status-tools-section'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { DisplayViewerStreamMetrics } from '@/features/applications/viewer/display/display-viewer-stream-status'
import type { ViewerSettings } from '@/features/applications/viewer/settings/viewer-settings'
import type { AutomationRun } from '@/shared/contracts/automation'

export const RuntimeToolContent = ({
  app,
  initialAiContextualSuggestionsEnabled,
  latestAutomationRun,
  latestStreamMetrics,
  onAppChange,
  onOpenWorkflowDraft,
  onRunStarted,
  onToolSelected,
  onViewerSettingsChange,
  permissions,
  toolId,
  viewerSettings
}: {
  app: AppDefinition
  initialAiContextualSuggestionsEnabled: boolean
  latestAutomationRun: AutomationRun | null
  latestStreamMetrics: DisplayViewerStreamMetrics | null
  onAppChange: (app: AppDefinition) => void
  onOpenWorkflowDraft: () => void
  onRunStarted: (run: AutomationRun) => void
  onToolSelected: (toolId: RuntimeToolId) => void
  onViewerSettingsChange: (settings: ViewerSettings) => void
  permissions: PermissionMap
  toolId: RuntimeToolId
  viewerSettings: ViewerSettings
}) => {
  const sectionClassName = runtimeInlineSectionClassName

  if (toolId === 'clipboard') {
    return (
      <ClipboardToolsSection
        app={app}
        permissions={permissions}
        className={cn(sectionClassName, 'px-0')}
        hideHeader
      />
    )
  }

  if (toolId === 'files') {
    return (
      <DownloadsToolsSection
        app={app}
        permissions={permissions}
        className={cn(sectionClassName, 'px-0')}
        hideHeader
      />
    )
  }

  if (toolId === 'logs') {
    return (
      <div className='min-h-30 max-h-300 overflow-auto'>
        <AppLogsContent app={app} />
      </div>
    )
  }

  if (toolId === 'ai-agent') {
    return (
      <AiAgentToolsSection
        app={app}
        canSaveWorkflow={hasPermission(permissions, 'automations:manage')}
        className={sectionClassName}
        contextualSuggestionsEnabled={initialAiContextualSuggestionsEnabled}
        draftWorkflowFromRun={draftWorkflowFromAdHocRunAction}
        generatePromptSuggestions={suggestAdHocAiPromptsAction}
        hideHeader
        openWorkflowDraft={onOpenWorkflowDraft}
        onRunStarted={run => {
          onRunStarted(run)
          onToolSelected('ai-agent')
        }}
      />
    )
  }

  if (toolId === 'workflows') {
    return (
      <AutomationStatusToolsSection
        app={app}
        latestRun={latestAutomationRun}
        className={cn(sectionClassName, 'px-0')}
        hideHeader
        onRunStarted={run => {
          onRunStarted(run)
          onToolSelected('workflows')
        }}
      />
    )
  }

  if (toolId === 'network-access') {
    return (
      <NetworkAccessToolsSection
        app={app}
        permissions={permissions}
        onAppChange={onAppChange}
        className={cn(sectionClassName, 'px-0')}
        hideHeader
      />
    )
  }

  return (
    <StreamingToolsSection
      viewerSettings={viewerSettings}
      onViewerSettingsChange={onViewerSettingsChange}
      streamMetrics={latestStreamMetrics}
      className={cn(sectionClassName, 'px-0')}
      hideHeader
    />
  )
}
