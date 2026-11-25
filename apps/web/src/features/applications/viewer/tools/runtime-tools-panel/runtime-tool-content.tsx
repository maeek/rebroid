import dynamic from 'next/dynamic'
import { draftWorkflowFromAdHocRunAction } from '@/server/orchestrator/automations/automation-management-actions'
import { suggestAdHocAiPromptsAction } from '@/server/orchestrator/automations/automation-run-actions'
import { useFeatureFlags } from '@/shared/model/features/feature-flags-context'
import { hasPermission, type PermissionMap } from '@/shared/permissions/permissions'
import { runtimeInlineSectionClassName, type RuntimeToolId } from './runtime-tool-definitions'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

const AiAgentToolsSection = dynamic(() =>
  import('./ai-agent/ai-agent-tools-section').then(module => module.AiAgentToolsSection)
)
const DownloadsToolsSection = dynamic(() =>
  import('./files/downloads-tools-section').then(module => module.DownloadsToolsSection)
)
const AppWorkflowsSection = dynamic(() =>
  import('./workflows/app-workflows-section').then(module => module.AppWorkflowsSection)
)

export const RuntimeToolContent = ({
  app,
  initialAiContextualSuggestionsEnabled,
  onOpenWorkflowDraft,
  onToolSelected,
  permissions,
  toolId
}: {
  app: AppDefinition
  initialAiContextualSuggestionsEnabled: boolean
  onOpenWorkflowDraft: () => void
  onToolSelected: (toolId: RuntimeToolId) => void
  permissions: PermissionMap
  toolId: RuntimeToolId
}) => {
  const sectionClassName = runtimeInlineSectionClassName

  const { isFeatureEnabled } = useFeatureFlags()
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
        key={app.id}
        app={app}
        canSaveWorkflow={isFeatureEnabled('feature.workflows') && hasPermission(permissions, 'automations:manage')}
        className={sectionClassName}
        contextualSuggestionsEnabled={initialAiContextualSuggestionsEnabled}
        draftWorkflowFromRun={draftWorkflowFromAdHocRunAction}
        generatePromptSuggestions={suggestAdHocAiPromptsAction}
        openWorkflowDraft={onOpenWorkflowDraft}
        onRunStarted={() => onToolSelected('ai-agent')}
      />
    )
  }

  if (toolId === 'workflows') {
    return (
      <AppWorkflowsSection
        key={app.id}
        appId={app.id}
        canViewFullTrace={hasPermission(permissions, 'automations:manage')}
      />
    )
  }

  return null
}
