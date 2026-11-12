import { useEffect, useState } from 'react'
import { IconRefresh } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { MutationButton } from '@/components/ui/mutation-button'
import { Notice } from '@/components/ui/notice'
import { Section } from '@/components/ui/section'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SingleSelectCombobox } from '@/components/ui/single-select-combobox'
import { ProviderModelPurposes } from './provider-model-purposes'
import type { AutomationAiProviderModelRole } from './provider-form-model'
import type { AutomationAiProviderModelDownload, AutomationAiProviderRemoteModel } from '@/shared/contracts/ai-provider'

type ModelSource = 'available' | 'manual' | 'download'

export const ProviderModelAddDialog = ({
  open,
  isSubmitting,
  isLoadingRemoteModels,
  providerKind,
  remoteModels,
  remoteModelsError,
  onLoadRemoteModels,
  onOpenChange,
  onAddExisting,
  onDownload,
  configuredModelIds = []
}: {
  open: boolean
  isSubmitting: boolean
  isLoadingRemoteModels: boolean
  providerKind: string
  remoteModels: AutomationAiProviderRemoteModel[]
  remoteModelsError: string | null
  configuredModelIds?: string[]
  onLoadRemoteModels: () => void | Promise<void>
  onOpenChange: (open: boolean) => void
  onAddExisting: (
    modelId: string,
    label?: string,
    roles?: AutomationAiProviderModelRole[]
  ) => boolean | Promise<boolean>
  onDownload: (modelId: string, label?: string) => Promise<void>
}) => {
  const [source, setSource] = useState<ModelSource>('available')
  const [modelId, setModelId] = useState('')
  const [label, setLabel] = useState('')
  const [roles, setRoles] = useState<AutomationAiProviderModelRole[]>(['controller', 'planner'])
  const [submitting, setSubmitting] = useState(false)
  const busy = isSubmitting || submitting
  const availableModels = remoteModels.filter(model => !configuredModelIds.includes(model.id))
  const duplicate = configuredModelIds.includes(modelId.trim())
  const openAi = providerKind === 'openai'

  useEffect(() => {
    if (!open) return
    setSource('available')
    setModelId('')
    setLabel('')
    setRoles(['controller', 'planner'])
    void onLoadRemoteModels()
  }, [open, onLoadRemoteModels])

  const submit = async () => {
    setSubmitting(true)
    try {
      if (source === 'download') {
        await onDownload(modelId, label)
        onOpenChange(false)
      } else if (await onAddExisting(modelId, label, roles)) onOpenChange(false)
    } catch {
      // Keep the draft open; the controller reports the failed operation.
    } finally {
      setSubmitting(false)
    }
  }

  const modelDetails = (
    <div className='grid gap-5'>
      <FormField
        controlId='provider-model-label'
        label='Display name'
        description='Optional name shown in model pickers.'
        layout='vertical'
      >
        <Input
          value={label}
          onChange={event => setLabel(event.target.value)}
          placeholder={modelId || undefined}
        />
      </FormField>
      <ProviderModelPurposes
        roles={roles}
        onChange={setRoles}
        disabled={busy}
      />
    </div>
  )

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (!busy) onOpenChange(next)
      }}
    >
      <DialogContent
        data-editor-dialog=''
        className='max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl'
      >
        <DialogHeader>
          <DialogTitle>Add model</DialogTitle>
          <DialogDescription>
            {openAi
              ? 'Choose a model from your OpenAI project. Adding saves immediately.'
              : 'Register a model with this provider. Adding saves immediately.'}
          </DialogDescription>
        </DialogHeader>
        <fieldset
          disabled={busy}
          className='grid min-w-0 gap-6'
        >
          <FormField
            controlId='provider-model-source'
            label='Model source'
            layout='vertical'
          >
            <Select
              value={source}
              disabled={busy}
              onValueChange={value => {
                setSource(value)
                setModelId('')
                setLabel('')
              }}
            >
              <SelectTrigger className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='available'>Available on provider</SelectItem>
                <SelectItem value='manual'>Enter model ID</SelectItem>
                {providerKind === 'ollama' ? <SelectItem value='download'>Download with Ollama</SelectItem> : null}
              </SelectContent>
            </Select>
          </FormField>
          {source === 'available' ? (
            <div className='grid gap-3'>
              <FormField
                controlId='provider-model-available'
                label='Available model'
                layout='vertical'
                description='Search models reported by the saved provider connection. Configured models are excluded.'
                error={remoteModelsError ?? undefined}
              >
                <SingleSelectCombobox
                  value={modelId}
                  disabled={busy || isLoadingRemoteModels}
                  placeholder={isLoadingRemoteModels ? 'Loading available models…' : 'Search available models'}
                  options={availableModels.map(model => ({
                    value: model.id,
                    label: model.label || model.id,
                    description: [model.id, model.parameterSize, model.quantizationLevel].filter(Boolean).join(' · ')
                  }))}
                  onValueChange={id => {
                    setModelId(id)
                    setLabel(remoteModels.find(model => model.id === id)?.label ?? '')
                  }}
                />
              </FormField>
              <Button
                type='button'
                variant='ghost'
                className='justify-self-start'
                disabled={busy || isLoadingRemoteModels}
                onClick={() => void onLoadRemoteModels()}
              >
                <IconRefresh className='size-4' /> Refresh available models
              </Button>
              {!isLoadingRemoteModels && !remoteModelsError && availableModels.length === 0 ? (
                <p className='text-sm text-foreground-muted'>
                  No unconfigured models found. Enter an exact model ID
                  {providerKind === 'ollama' ? ' or download a model' : ''} instead.
                </p>
              ) : null}
            </div>
          ) : (
            <FormField
              controlId='provider-model-id'
              label='Model ID'
              layout='vertical'
              error={duplicate ? 'This model is already configured.' : undefined}
              description={
                source === 'download'
                  ? 'Exact Ollama model name and tag. The download runs in the background.'
                  : 'Use the exact identifier accepted by the provider. This does not download a model.'
              }
            >
              <Input
                value={modelId}
                placeholder='Model ID, including any tag'
                onChange={event => setModelId(event.target.value)}
              />
            </FormField>
          )}
          {source === 'download' ? (
            <>
              <FormField
                controlId='provider-model-label'
                label='Display name (optional)'
                layout='vertical'
              >
                <Input
                  value={label}
                  onChange={event => setLabel(event.target.value)}
                  placeholder={modelId || undefined}
                />
              </FormField>
              <Notice description='Ollama adds this model for planning and device control. Download progress appears in the model list.' />
            </>
          ) : openAi ? (
            <Section
              surface='plain'
              title='Model options'
              description='Available for planning and device control by default.'
              collapsible
              headingSpacing='compact'
            >
              {modelDetails}
            </Section>
          ) : (
            modelDetails
          )}
        </fieldset>
        <DialogFooter>
          <Button
            type='button'
            variant='ghost'
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <MutationButton
            type='button'
            pending={busy}
            pendingLabel={source === 'download' ? 'Starting download…' : 'Adding model…'}
            disabled={
              !modelId.trim() ||
              duplicate ||
              (source !== 'download' && roles.length === 0) ||
              (source === 'available' && isLoadingRemoteModels)
            }
            onClick={() => void submit()}
          >
            {source === 'download' ? 'Download and add' : 'Add model'}
          </MutationButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export const ProviderModelDownloadStatus = ({ download }: { download: AutomationAiProviderModelDownload }) => {
  const isActive = download.status === 'queued' || download.status === 'running'
  const percent = typeof download.percent === 'number' ? download.percent : null
  let variant: 'success' | 'danger' | 'neutral' = 'neutral'
  let label = download.status === 'queued' ? 'Queued' : 'Downloading'
  if (download.status === 'completed') {
    variant = 'success'
    label = 'Downloaded'
  }
  if (download.status === 'failed') {
    variant = 'danger'
    label = 'Failed'
  }
  return (
    <div className='grid min-w-40 gap-1'>
      <div className='flex items-center gap-2'>
        <Badge variant={variant}>{label}</Badge>
        {percent !== null ? <span className='text-xs text-foreground-muted'>{percent}%</span> : null}
      </div>
      <p className='line-clamp-2 text-xs text-foreground-muted'>{download.message}</p>
      {isActive ? (
        <div className='h-1.5 overflow-hidden rounded-full bg-surface-band'>
          <div
            className='h-full rounded-full bg-primary transition-all'
            style={{ width: `${percent ?? 8}%` }}
          />
        </div>
      ) : null}
    </div>
  )
}
