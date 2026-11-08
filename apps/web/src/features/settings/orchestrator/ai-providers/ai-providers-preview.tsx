'use client'

import { useState } from 'react'
import { IconDeviceFloppy } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Switch } from '@/components/ui/switch'
import { AiProvidersPageLayout } from './ai-providers-page-layout'
import { ProviderDialog } from './provider-dialog'
import { ProviderConnectionSection } from './provider-edit-form-sections'
import { ProviderEditorLayout } from './provider-editor-layout'
import { createProviderModelRows, emptyModel, emptyProvider, updateProviderModelAt } from './provider-form-model'
import { ProviderHealthBanner } from './provider-health-badge'
import { ProviderModelDefaults } from './provider-model-defaults'
import { normalizeModelDefaults } from './provider-model-usage'
import { ProviderModelsGrid } from './provider-models-grid'
import { ProvidersGrid } from './providers-grid'
import type { AutomationAiProvider } from '@/shared/contracts/ai-provider'

const initialProvider: AutomationAiProvider = {
  ...emptyProvider(),
  id: 'local-models',
  label: 'Local model server',
  enabled: true,
  models: normalizeModelDefaults([
    { ...emptyModel(), id: 'device-controller:latest', label: 'Device controller', roles: ['controller', 'planner'] },
    { ...emptyModel(), id: 'screen-vision:latest', label: 'Screen vision', roles: ['vision'] }
  ])
}
const remoteModels = [
  { id: 'another-model:latest', label: 'Another model', parameterSize: '8B' },
  { id: 'device-controller:latest', label: 'Device controller' }
]
const noop = () => undefined

export const AiProvidersPreview = ({ view }: { view: 'list' | 'models' | 'connection' }) => {
  const [provider, setProvider] = useState(initialProvider)
  const [creating, setCreating] = useState<AutomationAiProvider | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [suggestions, setSuggestions] = useState(true)
  const updateModels = (models: AutomationAiProvider['models']) =>
    setProvider(current => ({ ...current, models: normalizeModelDefaults(models) }))
  if (view === 'list')
    return (
      <>
        <AiProvidersPageLayout
          actions={<Button onClick={() => setCreating(emptyProvider())}>Add provider</Button>}
          providers={
            <ProvidersGrid
              providers={[provider]}
              busyId={null}
              selectedIds={selected}
              onSelectedIdsChange={setSelected}
              onEnableSelected={noop}
              onDisableSelected={noop}
              onDeleteSelected={noop}
              onEdit={noop}
              onDelete={noop}
            />
          }
          suggestions={
            <FormField
              controlId='preview-context'
              label='Context suggestions'
              description='Generate prompt suggestions in app sessions. Changes save immediately.'
              layout='vertical'
            >
              <Switch
                checked={suggestions}
                onCheckedChange={setSuggestions}
              />
            </FormField>
          }
        />
        <ProviderDialog
          provider={creating}
          isSaving={false}
          onChange={setCreating}
          onClose={() => setCreating(null)}
          onSave={noop}
        />
      </>
    )
  return (
    <ProviderEditorLayout
      provider={provider}
      view={view}
      health={<ProviderHealthBanner provider={provider} />}
      actions={
        <>
          <Button
            variant='ghost'
            disabled
          >
            Discard changes
          </Button>
          <Button disabled>
            <IconDeviceFloppy className='size-4' />
            Save
          </Button>
        </>
      }
    >
      {view === 'connection' ? (
        <ProviderConnectionSection
          provider={provider}
          onChange={patch => setProvider(current => ({ ...current, ...patch }))}
        />
      ) : (
        <>
          <ProviderModelDefaults
            models={provider.models}
            onChange={(index, role) =>
              updateModels(
                provider.models.map((model, current) => ({
                  ...model,
                  defaultFor:
                    current === index ? [...model.defaultFor, role] : model.defaultFor.filter(item => item !== role)
                }))
              )
            }
          />
          <ProviderModelsGrid
            initialProvider={provider}
            modelRows={createProviderModelRows(provider.models)}
            onAddModel={(id, label, roles) => {
              updateModels([
                ...provider.models,
                { ...emptyModel(), id, label: label || id, roles: roles ?? ['controller', 'planner'] }
              ])
              return true
            }}
            onBulkRemoveModels={indexes => updateModels(provider.models.filter((_, index) => !indexes.includes(index)))}
            onBulkUpdateModels={(indexes, patch) =>
              updateModels(
                provider.models.map((model, index) => (indexes.includes(index) ? { ...model, ...patch } : model))
              )
            }
            onDownloadModel={() => Promise.resolve()}
            onRemoveModel={index => updateModels(provider.models.filter((_, current) => current !== index))}
            onUpdateModel={(index, patch) => updateModels(updateProviderModelAt(provider.models, index, patch))}
            isDownloadingModel={false}
            isLoadingRemoteModels={false}
            modelDownloads={{}}
            remoteModels={remoteModels}
            remoteModelsError={null}
            onLoadRemoteModels={noop}
          />
        </>
      )}
    </ProviderEditorLayout>
  )
}
