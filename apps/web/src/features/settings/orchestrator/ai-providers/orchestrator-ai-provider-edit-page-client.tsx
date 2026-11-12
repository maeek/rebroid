'use client'

import { IconDeviceFloppy } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { MutationButton } from '@/components/ui/mutation-button'
import { ProviderConnectionSection } from './provider-edit-form-sections'
import { ProviderEditorLayout, type ProviderEditorView } from './provider-editor-layout'
import { ProviderHealthBanner } from './provider-health-badge'
import { ProviderModelDefaults } from './provider-model-defaults'
import { ProviderModelsGrid } from './provider-models-grid'
import { useAiProviderEditController } from './use-ai-provider-edit-controller'
import type { AutomationAiProvider } from '@/shared/contracts/ai-provider'

export const OrchestratorAiProviderEditPageClient = ({
  initialProvider,
  view = 'models'
}: {
  initialProvider: AutomationAiProvider
  view?: ProviderEditorView
}) => {
  const controller = useAiProviderEditController(initialProvider)
  const { provider, savedProvider, isDirty, isSaving, isDownloadingModel } = controller
  const busy = isSaving || isDownloadingModel
  return (
    <ProviderEditorLayout
      provider={savedProvider}
      view={view}
      actions={
        <>
          {isDirty ? (
            <span
              className='self-center text-xs text-foreground-muted'
              role='status'
            >
              Unsaved changes
            </span>
          ) : null}
          <Button
            type='button'
            variant='ghost'
            disabled={!isDirty || busy}
            onClick={controller.discardChanges}
          >
            Discard changes
          </Button>
          <MutationButton
            type='button'
            pending={isSaving}
            pendingLabel='Saving…'
            disabled={!isDirty || isDownloadingModel}
            onClick={() => void controller.saveProvider()}
          >
            <IconDeviceFloppy className='size-4' /> Save
          </MutationButton>
        </>
      }
      health={
        <ProviderHealthBanner
          provider={savedProvider}
          disabled={isDirty || busy}
        />
      }
    >
      {view === 'connection' ? (
        <ProviderConnectionSection
          provider={provider}
          disabled={busy}
          onChange={controller.updateProvider}
        />
      ) : (
        <>
          <ProviderModelDefaults
            models={provider.models}
            disabled={busy}
            onChange={controller.setDefaultModel}
          />
          <ProviderModelsGrid
            initialProvider={savedProvider}
            modelRows={controller.modelRows}
            disabled={busy}
            hasUnsavedChanges={isDirty}
            onAddModel={controller.addModel}
            onBulkRemoveModels={controller.removeModels}
            onBulkUpdateModels={controller.updateModels}
            onDownloadModel={controller.downloadModel}
            onRemoveModel={controller.removeModel}
            onUpdateModel={controller.updateModel}
            isDownloadingModel={isDownloadingModel}
            isLoadingRemoteModels={controller.isLoadingRemoteModels}
            modelDownloads={controller.modelDownloads}
            remoteModels={controller.remoteModels}
            remoteModelsError={controller.remoteModelsError}
            onLoadRemoteModels={controller.loadRemoteModels}
          />
        </>
      )}
    </ProviderEditorLayout>
  )
}
