import { IconAlertTriangle, IconSparkles, IconTrash } from '@tabler/icons-react'
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
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { selectCatalogModel } from '@/shared/automation/automation-ai-catalog'
import type { AutomationAiModelCatalogProvider } from '@/server/orchestrator/settings/types'

export const AiDraftDialog = ({
  open,
  busy,
  catalog,
  providerId,
  modelId,
  prompt,
  onDraft,
  onModelChange,
  onOpenChange,
  onProviderChange,
  onPromptChange
}: {
  open: boolean
  busy: boolean
  catalog: AutomationAiModelCatalogProvider[]
  providerId: string
  modelId: string
  prompt: string
  onDraft: () => void
  onModelChange: (modelId: string) => void
  onOpenChange: (open: boolean) => void
  onProviderChange: (providerId: string) => void
  onPromptChange: (prompt: string) => void
}) => {
  const selectedProvider = catalog.find(provider => provider.id === providerId) ?? catalog[0]
  const selectedModel = selectCatalogModel(selectedProvider, modelId)

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Draft automation</DialogTitle>
          <DialogDescription>Generate a runnable AI automation draft into the YAML editor.</DialogDescription>
        </DialogHeader>
        <div className='grid gap-4'>
          <div className='grid gap-3 md:grid-cols-2'>
            <div className='grid gap-2'>
              <Label>Provider</Label>
              <Select
                value={selectedProvider?.id ?? ''}
                disabled={catalog.length === 0}
                onValueChange={nextProviderId => {
                  const nextProvider = catalog.find(provider => provider.id === nextProviderId)
                  const nextModel = selectCatalogModel(nextProvider, '')
                  onProviderChange(nextProviderId)
                  onModelChange(nextModel?.id ?? '')
                }}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder='Select provider' />
                </SelectTrigger>
                <SelectContent>
                  {catalog.map(provider => (
                    <SelectItem
                      key={provider.id}
                      value={provider.id}
                    >
                      {provider.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='grid gap-2'>
              <Label>Model</Label>
              <Select
                value={selectedModel?.id ?? ''}
                disabled={!selectedProvider}
                onValueChange={onModelChange}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder='Select model' />
                </SelectTrigger>
                <SelectContent>
                  {(selectedProvider?.models ?? []).map(model => (
                    <SelectItem
                      key={model.id}
                      value={model.id}
                    >
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Textarea
            value={prompt}
            rows={6}
            placeholder='Describe the workflow this automation should perform.'
            onChange={event => onPromptChange(event.target.value)}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant='secondary'>Cancel</Button>
          </DialogClose>
          <Button
            disabled={busy || !prompt.trim() || !selectedProvider || !selectedModel}
            onClick={onDraft}
          >
            <IconSparkles className='size-4' />
            Draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export const AutomationDeleteConfirmDialog = ({
  open,
  busy,
  automationName,
  onConfirm,
  onOpenChange
}: {
  open: boolean
  busy: boolean
  automationName: string
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
}) => (
  <Dialog
    open={open}
    onOpenChange={onOpenChange}
  >
    <DialogContent className='sm:max-w-md'>
      <DialogHeader>
        <DialogTitle>Delete {automationName}?</DialogTitle>
        <DialogDescription>This removes the workflow and its triggers.</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <DialogClose asChild>
          <Button
            variant='secondary'
            disabled={busy}
          >
            Cancel
          </Button>
        </DialogClose>
        <Button
          variant='destructive'
          disabled={busy}
          onClick={onConfirm}
        >
          <IconTrash className='size-4' />
          Delete
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
)

export const UnsavedAutomationChangesDialog = ({
  open,
  onConfirm,
  onOpenChange
}: {
  open: boolean
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
}) => (
  <Dialog
    open={open}
    onOpenChange={onOpenChange}
  >
    <DialogContent className='sm:max-w-md'>
      <DialogHeader>
        <DialogTitle>Leave without saving?</DialogTitle>
        <DialogDescription>This workflow has unsaved changes. Leaving now will discard them.</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant='secondary'>Stay</Button>
        </DialogClose>
        <Button onClick={onConfirm}>
          <IconAlertTriangle className='size-4' />
          Leave
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
)
