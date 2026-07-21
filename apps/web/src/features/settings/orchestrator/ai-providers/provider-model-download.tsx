import { useEffect, useMemo, useState } from 'react'
import { IconDownload, IconPlus, IconRefresh } from '@tabler/icons-react'
import { GradientSparklesIcon } from '@/components/icons/gradient-sparkles-icon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { AutomationAiProviderModelDownload, AutomationAiProviderRemoteModel } from '@/shared/contracts/ai-provider'

const MANUAL_VALUE = '__manual__'

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
  onDownload
}: {
  open: boolean
  isSubmitting: boolean
  isLoadingRemoteModels: boolean
  providerKind: string
  remoteModels: AutomationAiProviderRemoteModel[]
  remoteModelsError: string | null
  onLoadRemoteModels: () => void | Promise<void>
  onOpenChange: (open: boolean) => void
  onAddExisting: (modelId: string, label?: string) => boolean | Promise<boolean>
  onDownload: (modelId: string, label?: string) => Promise<void>
}) => {
  const [selectedValue, setSelectedValue] = useState('')
  const [downloadModelId, setDownloadModelId] = useState('')
  const [downloadLabel, setDownloadLabel] = useState('')
  const [isLocallySubmitting, setIsLocallySubmitting] = useState(false)
  const canDownloadModels = providerKind === 'ollama'
  const selectedRemoteModel = useMemo(
    () => remoteModels.find(model => model.id === selectedValue),
    [remoteModels, selectedValue]
  )
  const isManualMode = selectedValue === MANUAL_VALUE
  const submitting = isSubmitting || isLocallySubmitting

  useEffect(() => {
    if (!open) return
    setSelectedValue('')
    setDownloadModelId('')
    setDownloadLabel('')
    void onLoadRemoteModels()
  }, [onLoadRemoteModels, open])

  const submit = async () => {
    setIsLocallySubmitting(true)
    try {
      if (isManualMode) {
        if (canDownloadModels) {
          await onDownload(downloadModelId, downloadLabel)
          onOpenChange(false)
          return
        }
        if (await onAddExisting(downloadModelId, downloadLabel)) {
          onOpenChange(false)
        }
        return
      }
      if (selectedRemoteModel && (await onAddExisting(selectedRemoteModel.id, selectedRemoteModel.label))) {
        onOpenChange(false)
      }
    } catch {
      // The controller owns the toast. Keep the dialog open so the model ID can be corrected.
    } finally {
      setIsLocallySubmitting(false)
    }
  }

  const submitIcon = () => {
    if (isManualMode && canDownloadModels) {
      return <IconDownload className={submitting ? 'size-4 animate-pulse' : 'size-4'} />
    }
    return <IconPlus className='size-4' />
  }

  const submitLabel = () => {
    if (submitting) {
      return isManualMode && canDownloadModels ? 'Starting' : 'Adding'
    }
    if (isManualMode && canDownloadModels) {
      return 'Add and download'
    }
    return 'Add model'
  }

  const manualDescription = canDownloadModels
    ? 'Enter an Ollama model name to pull in the background.'
    : 'Enter a model ID that already exists on this provider.'

  const emptyRemoteModelsMessage = canDownloadModels
    ? 'No installed models were reported. Download a new model to add it.'
    : 'No models were reported. Enter a model ID manually if the provider is reachable.'

  return (
    <Dialog
      open={open}
      onOpenChange={nextOpen => {
        if (!nextOpen && submitting) return
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className='sm:max-w-xl'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <GradientSparklesIcon className='size-5' />
            Add model
          </DialogTitle>
          <DialogDescription>
            {canDownloadModels
              ? 'Select a model already available on the provider or start a background download.'
              : 'Select a model reported by the provider or enter an existing model ID manually.'}
          </DialogDescription>
        </DialogHeader>
        <div className='grid gap-4'>
          <FormField
            controlId='provider-model-available'
            label='Available model'
            description='Models reported by the configured provider.'
            layout='vertical'
            contentClassName='block'
          >
            <div className='flex w-full gap-2'>
              <Select
                value={selectedValue}
                onValueChange={setSelectedValue}
                disabled={isLoadingRemoteModels}
              >
                <SelectTrigger
                  id='provider-model-available'
                  className='w-full'
                  aria-describedby='provider-model-available-description'
                >
                  <SelectValue placeholder={isLoadingRemoteModels ? 'Loading models' : 'Select model'} />
                </SelectTrigger>
                <SelectContent>
                  {remoteModels.map(model => (
                    <SelectItem
                      key={model.id}
                      value={model.id}
                      label={
                        model.parameterSize
                          ? `${model.label || model.id} ${model.parameterSize}`
                          : model.label || model.id
                      }
                    >
                      <span>{model.label || model.id}</span>
                      {model.parameterSize ? (
                        <span className='ml-2 text-xs text-foreground-muted'>{model.parameterSize}</span>
                      ) : null}
                    </SelectItem>
                  ))}
                  <SelectItem value={MANUAL_VALUE}>
                    {canDownloadModels ? 'Download new model' : 'Enter model ID manually'}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button
                type='button'
                variant='secondary'
                size='icon-md'
                disabled={isLoadingRemoteModels}
                aria-label='Refresh available models'
                onClick={() => void onLoadRemoteModels()}
              >
                <IconRefresh className={isLoadingRemoteModels ? 'size-4 animate-spin' : 'size-4'} />
              </Button>
            </div>
            {remoteModelsError ? <p className='text-xs text-danger'>{remoteModelsError}</p> : null}
            {!remoteModelsError && !isLoadingRemoteModels && remoteModels.length === 0 ? (
              <p className='text-xs text-foreground-muted'>{emptyRemoteModelsMessage}</p>
            ) : null}
          </FormField>
          {isManualMode ? (
            <>
              <FormField
                controlId='provider-model-id'
                label='Model ID'
                description={manualDescription}
                layout='vertical'
              >
                <Input
                  value={downloadModelId}
                  placeholder={canDownloadModels ? 'qwen3.5:latest' : 'gemma-4'}
                  onChange={event => setDownloadModelId(event.target.value)}
                />
              </FormField>
              <FormField
                controlId='provider-model-label'
                label='Label'
                description='Optional display name shown in tables and model selectors.'
                layout='vertical'
              >
                <Input
                  value={downloadLabel}
                  placeholder={canDownloadModels ? 'Qwen 3.5 Latest' : 'Gemma 4'}
                  onChange={event => setDownloadLabel(event.target.value)}
                />
              </FormField>
              <p className='text-sm text-foreground-muted'>
                {canDownloadModels
                  ? 'The model row is added immediately. Download progress is shown in that row.'
                  : 'The model row is added without starting a provider-side download.'}
              </p>
            </>
          ) : null}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button
              type='button'
              variant='secondary'
              disabled={submitting}
            >
              Cancel
            </Button>
          </DialogClose>
          <Button
            type='button'
            disabled={
              submitting || (isManualMode ? !downloadModelId.trim() : !selectedRemoteModel || isLoadingRemoteModels)
            }
            onClick={() => void submit()}
          >
            {submitIcon()}
            {submitLabel()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export const ProviderModelDownloadStatus = ({ download }: { download: AutomationAiProviderModelDownload }) => {
  const isActive = download.status === 'queued' || download.status === 'running'
  const percent = typeof download.percent === 'number' ? download.percent : null
  return (
    <div className='grid min-w-40 gap-1'>
      <div className='flex items-center gap-2'>
        <Badge
          variant={download.status === 'completed' ? 'success' : download.status === 'failed' ? 'danger' : 'neutral'}
        >
          {download.status === 'completed' ? 'Downloaded' : download.status === 'failed' ? 'Error' : 'Downloading'}
        </Badge>
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
