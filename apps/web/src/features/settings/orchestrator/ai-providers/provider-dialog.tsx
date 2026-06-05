import { type ReactNode } from 'react'
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
import { Switch } from '@/components/ui/switch'
import type { ProviderFormState } from './provider-utils'

export const ProviderDialog = ({
  provider,
  isSaving,
  onChange,
  onClose,
  onSave
}: {
  provider: ProviderFormState | null
  isSaving: boolean
  onChange: (provider: ProviderFormState | null) => void
  onClose: () => void
  onSave: () => void
}) => {
  const update = (patch: Partial<ProviderFormState>) => {
    if (!provider) return
    onChange({ ...provider, ...patch })
  }

  return (
    <Dialog
      open={Boolean(provider)}
      onOpenChange={open => {
        if (!open) onClose()
      }}
    >
      <DialogContent className='sm:max-w-xl'>
        <DialogHeader>
          <DialogTitle>Add AI provider</DialogTitle>
          <DialogDescription>
            Configure the provider connection first. Add models from the provider editor after it is created.
          </DialogDescription>
        </DialogHeader>
        {provider ? (
          <div className='grid gap-5'>
            <div className='grid gap-4'>
              <Field
                label='Provider ID'
                description='Stable identifier used by automation steps and model selectors.'
              >
                <Input
                  value={provider.id}
                  placeholder='local-ollama'
                  onChange={event => update({ id: event.target.value })}
                />
              </Field>
              <Field
                label='Label'
                description='Human-readable name shown in tables, editors, and viewer controls.'
              >
                <Input
                  value={provider.label}
                  placeholder='Local Ollama'
                  onChange={event => update({ label: event.target.value })}
                />
              </Field>
              <Field
                label='Kind'
                description='Select the API protocol used by this provider.'
              >
                <Select
                  value={provider.kind}
                  onValueChange={kind => update({ kind: kind as ProviderFormState['kind'] })}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='ollama'>Ollama</SelectItem>
                    <SelectItem value='openai'>OpenAI</SelectItem>
                    <SelectItem value='openai-compatible'>OpenAI-compatible</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field
                label='Base URL'
                description='Use the provider root URL. OpenAI-compatible providers should include their /v1 endpoint.'
              >
                <Input
                  value={provider.baseUrl}
                  placeholder='http://localhost:11434'
                  onChange={event => update({ baseUrl: event.target.value })}
                />
              </Field>
              <Field
                label='API key'
                description='Stored as a secret. Leave blank for local providers.'
              >
                <Input
                  value={provider.apiKey ?? ''}
                  placeholder='Leave blank for local providers'
                  type='password'
                  onChange={event => update({ apiKey: event.target.value || null })}
                />
              </Field>
              <div className='flex items-center justify-between gap-3 rounded-md border border-border/70 bg-background/25 px-3 py-2'>
                <div>
                  <Label>Enabled</Label>
                  <p className='text-xs text-secondary-foreground'>
                    Keep disabled until at least one usable model is configured.
                  </p>
                </div>
                <Switch
                  checked={provider.enabled}
                  onCheckedChange={enabled => update({ enabled })}
                />
              </div>
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button
              type='button'
              variant='secondary'
            >
              Cancel
            </Button>
          </DialogClose>
          <Button
            type='button'
            disabled={isSaving}
            onClick={onSave}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
