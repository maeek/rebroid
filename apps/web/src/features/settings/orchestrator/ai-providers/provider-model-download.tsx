import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { IconDownload, IconPlus, IconRefresh } from '@tabler/icons-react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type {
  AutomationAiProviderModelDownload,
  AutomationAiProviderRemoteModel
} from '@/server/orchestrator/settings/types'

const DOWNLOAD_VALUE = '__download__'

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
  const canListRemoteModels = providerKind === 'ollama'
  const selectedRemoteModel = useMemo(
    () => remoteModels.find(model => model.id === selectedValue),
    [remoteModels, selectedValue]
  )
  const isDownloadMode = selectedValue === DOWNLOAD_VALUE || !canListRemoteModels

  useEffect(() => {
    if (!open) return
    setSelectedValue('')
    setDownloadModelId('')
    setDownloadLabel('')
    if (canListRemoteModels) void onLoadRemoteModels()
  }, [canListRemoteModels, onLoadRemoteModels, open])

  const submit = async () => {
    if (isDownloadMode) {
      try {
        await onDownload(downloadModelId, downloadLabel)
        onOpenChange(false)
      } catch {
        // The controller owns the toast. Keep the dialog open so the model ID can be corrected.
      }
      return
    }
    if (selectedRemoteModel && (await onAddExisting(selectedRemoteModel.id, selectedRemoteModel.label))) {
      onOpenChange(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={nextOpen => {
        if (!nextOpen && isSubmitting) return
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className='sm:max-w-xl'>
        <DialogHeader>
          <DialogTitle>Add model</DialogTitle>
          <DialogDescription>
            Select a model already available on the provider or start a background download.
          </DialogDescription>
        </DialogHeader>
        <div className='grid gap-4'>
          {canListRemoteModels ? (
            <Field
              label='Available model'
              description='Models reported by the configured Ollama server.'
            >
              <div className='flex gap-2'>
                <Select
                  value={selectedValue}
                  onValueChange={setSelectedValue}
                  disabled={isLoadingRemoteModels}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder={isLoadingRemoteModels ? 'Loading models' : 'Select model'} />
                  </SelectTrigger>
                  <SelectContent>
                    {remoteModels.map(model => (
                      <SelectItem
                        key={model.id}
                        value={model.id}
                      >
                        <span>{model.label || model.id}</span>
                        {model.parameterSize ? (
                          <span className='text-xs text-foreground-muted'>{model.parameterSize}</span>
                        ) : null}
                      </SelectItem>
                    ))}
                    <SelectItem value={DOWNLOAD_VALUE}>Download new model</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type='button'
                  variant='secondary'
                  size='icon'
                  disabled={isLoadingRemoteModels}
                  aria-label='Refresh available models'
                  onClick={() => void onLoadRemoteModels()}
                >
                  <IconRefresh className={isLoadingRemoteModels ? 'size-4 animate-spin' : 'size-4'} />
                </Button>
              </div>
              {remoteModelsError ? <p className='text-xs text-destructive'>{remoteModelsError}</p> : null}
              {!remoteModelsError && !isLoadingRemoteModels && remoteModels.length === 0 ? (
                <p className='text-xs text-foreground-muted'>
                  No installed models were reported. Download a new model to add it.
                </p>
              ) : null}
            </Field>
          ) : null}
          {isDownloadMode ? (
            <>
              <Field
                label='Model ID'
                description='Use the provider model name, for example qwen3.5:latest.'
              >
                <Input
                  value={downloadModelId}
                  placeholder='qwen3.5:latest'
                  onChange={event => setDownloadModelId(event.target.value)}
                />
              </Field>
              <Field
                label='Label'
                description='Optional display name shown in tables and model selectors.'
              >
                <Input
                  value={downloadLabel}
                  placeholder='Qwen 3.5 Latest'
                  onChange={event => setDownloadLabel(event.target.value)}
                />
              </Field>
              <p className='text-sm text-foreground-muted'>
                The model row is added immediately. Download progress is shown in that row.
              </p>
            </>
          ) : null}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button
              type='button'
              variant='secondary'
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </DialogClose>
          <Button
            type='button'
            disabled={
              isSubmitting || (isDownloadMode ? !downloadModelId.trim() : !selectedRemoteModel || isLoadingRemoteModels)
            }
            onClick={() => void submit()}
          >
            {isDownloadMode ? (
              <IconDownload className={isSubmitting ? 'size-4 animate-pulse' : 'size-4'} />
            ) : (
              <IconPlus className='size-4' />
            )}
            {isSubmitting ? 'Starting' : isDownloadMode ? 'Add and download' : 'Add model'}
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
          variant={
            download.status === 'completed' ? 'status' : download.status === 'failed' ? 'destructive' : 'secondary'
          }
        >
          {download.status === 'completed' ? 'Downloaded' : download.status === 'failed' ? 'Error' : 'Downloading'}
        </Badge>
        {percent !== null ? <span className='text-xs text-foreground-muted'>{percent}%</span> : null}
      </div>
      <p className='line-clamp-2 text-xs text-foreground-muted'>{download.message}</p>
      {isActive ? (
        <div className='h-1.5 overflow-hidden rounded-full bg-muted'>
          <div
            className='h-full rounded-full bg-primary transition-all'
            style={{ width: `${percent ?? 8}%` }}
          />
        </div>
      ) : null}
    </div>
  )
}

const Field = ({ label, description, children }: { label: string; description: string; children: ReactNode }) => (
  <div className='grid gap-2'>
    <div className='grid gap-1'>
      <Label>{label}</Label>
      <p className='text-xs text-foreground-muted'>{description}</p>
    </div>
    {children}
  </div>
)
