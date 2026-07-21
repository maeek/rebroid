'use client'

import { IconDeviceFloppy } from '@tabler/icons-react'
import { GradientSparklesIcon } from '@/components/icons/gradient-sparkles-icon'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { ProviderConnectionSection } from './provider-edit-form-sections'
import { ProviderHealthBanner } from './provider-health-badge'
import { ProviderModelsGrid } from './provider-models-grid'
import { useAiProviderEditController } from './use-ai-provider-edit-controller'
import type { AutomationAiProvider } from '@/shared/contracts/ai-provider'

export const OrchestratorAiProviderEditPageClient = ({
  initialProvider
}: {
  initialProvider: AutomationAiProvider
}) => {
  const {
    addModel,
    isSaving,
    isLoadingRemoteModels,
    loadRemoteModels,
    modelDownloads,
    modelRows,
    provider,
    remoteModels,
    remoteModelsError,
    removeModel,
    saveProvider,
    setDefaultModel,
    downloadModel,
    isDownloadingModel,
    removeModels,
    updateModel,
    updateModels,
    updateProvider
  } = useAiProviderEditController(initialProvider)

  return (
    <StandardPage className='gap-2'>
      <PageHeader
        section={{ label: 'Platform', href: '/platform' }}
        trail={[{ label: 'AI', href: '/platform/ai' }]}
        title={initialProvider.label}
        leading={<GradientSparklesIcon className='size-8 max-sm:size-5' />}
        description='Edit provider connection details and the models exposed to AI automation steps.'
        actions={
          <div className='flex flex-wrap items-center justify-end gap-4'>
            <div className='flex items-center gap-2'>
              <Label className='text-sm'>Enabled</Label>
              <Switch
                checked={provider.enabled}
                onCheckedChange={enabled => updateProvider({ enabled })}
              />
            </div>
            <Button
              type='button'
              disabled={isSaving}
              onClick={() => void saveProvider()}
            >
              <IconDeviceFloppy className='size-4' />
              Save
            </Button>
          </div>
        }
      />
      <PageContent>
        <ProviderHealthBanner provider={initialProvider} />
        <ProviderConnectionSection
          provider={provider}
          onChange={updateProvider}
        />
        <ProviderModelsGrid
          initialProvider={initialProvider}
          modelRows={modelRows}
          onAddModel={addModel}
          onBulkRemoveModels={removeModels}
          onBulkUpdateModels={updateModels}
          onDownloadModel={downloadModel}
          onRemoveModel={removeModel}
          onSetDefaultModel={setDefaultModel}
          onUpdateModel={updateModel}
          isDownloadingModel={isDownloadingModel}
          isLoadingRemoteModels={isLoadingRemoteModels}
          modelDownloads={modelDownloads}
          remoteModels={remoteModels}
          remoteModelsError={remoteModelsError}
          onLoadRemoteModels={loadRemoteModels}
        />
      </PageContent>
    </StandardPage>
  )
}
