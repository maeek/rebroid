'use client'

import { Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { Notice } from '@/components/ui/notice'
import { useApplicationViewerApp } from '@/features/applications/detail/application-viewer-context'
import { appResourceHref } from '@/shared/model/applications/app-resource-links'
import { useFeatureFlags } from '@/shared/model/features/feature-flags-context'
import { RuntimeToolContent } from './runtime-tool-content'
import { getRuntimeTools, type RuntimeToolId } from './runtime-tool-definitions'
import { RuntimeToolPanelLayout } from './runtime-tool-panel-layout'
import { RuntimeToolLoadingContent, RuntimeToolsPanelLoading } from './runtime-tools-panel-loading'

export const RuntimeToolsPanel = ({ toolId }: { toolId: RuntimeToolId }) => {
  const router = useRouter()
  const { app, initialSettings, permissions } = useApplicationViewerApp()
  const { isFeatureEnabled, isLoading } = useFeatureFlags()
  if (
    isLoading &&
    toolId !== 'files' &&
    getRuntimeTools({ permissions, isFeatureEnabled: () => true }).some(tool => tool.id === toolId)
  ) {
    return <RuntimeToolsPanelLoading toolId={toolId} />
  }
  const available = getRuntimeTools({ permissions, isFeatureEnabled }).some(tool => tool.id === toolId)
  if (!available)
    return (
      <Notice
        title='Tool unavailable'
        description='This tool is unavailable for your account or disabled by the platform.'
      />
    )

  return (
    <RuntimeToolPanelLayout toolId={toolId}>
      <Suspense
        key={toolId}
        fallback={<RuntimeToolLoadingContent toolId={toolId} />}
      >
        <RuntimeToolContent
          app={app}
          initialAiContextualSuggestionsEnabled={initialSettings.aiContextualSuggestionsEnabled}
          onOpenWorkflowDraft={() => router.push('/automations/create')}
          onToolSelected={next => {
            if (next !== toolId) router.push(appResourceHref(app.id, next))
          }}
          permissions={permissions}
          toolId={toolId}
        />
      </Suspense>
    </RuntimeToolPanelLayout>
  )
}
