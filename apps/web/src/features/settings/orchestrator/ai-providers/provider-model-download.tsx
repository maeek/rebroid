import { type ReactNode } from 'react'
import { IconDownload } from '@tabler/icons-react'
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
import type { AutomationAiProviderModelDownload } from '@/server/orchestrator/settings/types'

export const ProviderModelDownloadDialog = ({
  open,
  isDownloading,
  modelId,
  label,
  onOpenChange,
  onModelIdChange,
  onLabelChange,
  onSubmit
}: {
  open: boolean
  isDownloading: boolean
  modelId: string
  label: string
  onOpenChange: (open: boolean) => void
  onModelIdChange: (modelId: string) => void
  onLabelChange: (label: string) => void
  onSubmit: () => void
}) => (
  <Dialog
    open={open}
    onOpenChange={nextOpen => {
      if (!nextOpen && isDownloading) return
      onOpenChange(nextOpen)
    }}
  >
    <DialogContent className='sm:max-w-xl'>
      <DialogHeader>
        <DialogTitle>Download Ollama model</DialogTitle>
        <DialogDescription>
          Pull a model into the configured Ollama server and add it to this provider when the download completes.
        </DialogDescription>
      </DialogHeader>
      <div className='grid gap-4'>
        <Field
          label='Model ID'
          description='Use the Ollama model name, for example qwen3.5:latest.'
        >
          <Input
            value={modelId}
            placeholder='qwen3.5:latest'
            onChange={event => onModelIdChange(event.target.value)}
          />
        </Field>
        <Field
          label='Label'
          description='Optional display name shown in tables and model selectors.'
        >
          <Input
            value={label}
            placeholder='Qwen 3.5 Latest'
            onChange={event => onLabelChange(event.target.value)}
          />
        </Field>
        <p className='text-sm text-secondary-foreground'>
          The download runs in the background after it starts. Progress is shown in the Models section.
        </p>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button
            type='button'
            variant='secondary'
            disabled={isDownloading}
          >
            Cancel
          </Button>
        </DialogClose>
        <Button
          type='button'
          disabled={isDownloading || !modelId.trim()}
          onClick={onSubmit}
        >
          <IconDownload className={isDownloading ? 'size-4 animate-pulse' : 'size-4'} />
          {isDownloading ? 'Starting' : 'Start download'}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
)

export const ProviderModelDownloadProgress = ({ download }: { download: AutomationAiProviderModelDownload }) => {
  const isActive = download.status === 'queued' || download.status === 'running'
  const percent = typeof download.percent === 'number' ? download.percent : null
  return (
    <div className='rounded-md border border-border/70 bg-background/35 px-4 py-3'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div className='min-w-0'>
          <div className='flex flex-wrap items-center gap-2'>
            <Badge
              variant={
                download.status === 'completed' ? 'status' : download.status === 'failed' ? 'destructive' : 'secondary'
              }
            >
              {download.status === 'completed' ? 'Downloaded' : download.status === 'failed' ? 'Error' : 'Downloading'}
            </Badge>
            <span className='font-medium'>{download.modelId}</span>
          </div>
          <p className='mt-1 break-words text-sm text-secondary-foreground'>{download.message}</p>
        </div>
        {percent !== null ? <span className='text-sm text-secondary-foreground'>{percent}%</span> : null}
      </div>
      {isActive ? (
        <div className='mt-3 h-2 overflow-hidden rounded-full bg-muted'>
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
      <p className='text-xs text-secondary-foreground'>{description}</p>
    </div>
    {children}
  </div>
)
