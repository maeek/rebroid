import { cn } from '@/lib/utils'
import { draftWorkflowFromAdHocRunAction } from '@/server/orchestrator/automations/automation-management-actions'
import { suggestAdHocAiPromptsAction } from '@/server/orchestrator/automations/automation-run-actions'
import { hasPermission, type PermissionMap } from '@/shared/permissions/permissions'
import { AiAgentToolsSection } from './ai-agent/ai-agent-tools-section'
import { ClipboardToolsSection } from './clipboard/clipboard-tools-section'
import { DownloadsToolsSection } from './files/downloads-tools-section'
import { runtimeInlineSectionClassName, type RuntimeToolId } from './runtime-tool-definitions'
import { AutomationStatusToolsSection } from './workflows/automation-status-tools-section'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { AutomationRun } from '@/shared/contracts/automation'

export const RuntimeToolContent = ({
  app,
  initialAiContextualSuggestionsEnabled,
  latestAutomationRun,
  onOpenWorkflowDraft,
  onRunStarted,
  onToolSelected,
  permissions,
  toolId
}: {
  app: AppDefinition
  initialAiContextualSuggestionsEnabled: boolean
  latestAutomationRun: AutomationRun | null
  onOpenWorkflowDraft: () => void
  onRunStarted: (run: AutomationRun) => void
  onToolSelected: (toolId: RuntimeToolId) => void
  permissions: PermissionMap
  toolId: RuntimeToolId
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
      />
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

  return null
}
