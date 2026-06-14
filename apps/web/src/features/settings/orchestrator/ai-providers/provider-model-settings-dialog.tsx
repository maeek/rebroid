import { type ReactNode } from 'react'
import { GradientSparklesIcon } from '@/components/icons/gradient-sparkles-icon'
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
import { Textarea } from '@/components/ui/textarea'
import type { AutomationAiProviderModel } from '@/server/orchestrator/settings/types'
import type { ProviderModelRow } from '@rebroid/ai-core/provider'

export const ProviderModelSettingsDialog = ({
  model,
  onClose,
  onChange
}: {
  model: ProviderModelRow | null
  onClose: () => void
  onChange: (index: number, patch: Partial<AutomationAiProviderModel>) => void
}) => {
  const settings = model?.settings ?? {}
  const updateSettings = (patch: Partial<AutomationAiProviderModel['settings']>) => {
    if (!model) return
    onChange(model.index, { settings: { ...settings, ...patch } })
  }

  return (
    <Dialog
      open={Boolean(model)}
      onOpenChange={open => {
        if (!open) onClose()
      }}
    >
      <DialogContent className='sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <GradientSparklesIcon className='size-5' />
            Model settings
          </DialogTitle>
          <DialogDescription>Configure optional model-level prompt and Ollama generation settings.</DialogDescription>
        </DialogHeader>
        {model ? (
          <div className='grid gap-4'>
            <Field
              label='System prompt'
              description='Additional system instructions appended to AI automation runs for this model.'
            >
              <Textarea
                value={settings.systemPrompt ?? ''}
                rows={5}
                onChange={event => updateSettings({ systemPrompt: event.target.value || null })}
              />
            </Field>
            <div className='grid gap-4 sm:grid-cols-2'>
              <NumberField
                label='Temperature'
                description='Sampling randomness from 0 to 2.'
                value={settings.temperature}
                min={0}
                max={2}
                step={0.1}
                onChange={temperature => updateSettings({ temperature })}
              />
              <NumberField
                label='Top P'
                description='Nucleus sampling value from 0 to 1.'
                value={settings.topP}
                min={0}
                max={1}
                step={0.05}
                onChange={topP => updateSettings({ topP })}
              />
              <NumberField
                label='Top K'
                description='Ollama top-k sampling limit.'
                value={settings.topK}
                min={0}
                max={500}
                step={1}
                onChange={topK => updateSettings({ topK })}
              />
              <NumberField
                label='Context length'
                description='Ollama num_ctx option.'
                value={settings.numCtx}
                min={128}
                max={262144}
                step={128}
                onChange={numCtx => updateSettings({ numCtx })}
              />
              <NumberField
                label='Repeat penalty'
                description='Ollama repeat_penalty option.'
                value={settings.repeatPenalty}
                min={0}
                max={4}
                step={0.05}
                onChange={repeatPenalty => updateSettings({ repeatPenalty })}
              />
              <NumberField
                label='Seed'
                description='Optional deterministic seed.'
                value={settings.seed}
                step={1}
                onChange={seed => updateSettings({ seed })}
              />
            </div>
            <Field
              label='Keep alive'
              description='Ollama keep_alive value such as 5m, 1h, or -1.'
            >
              <Input
                value={settings.keepAlive ?? ''}
                placeholder='5m'
                onChange={event => updateSettings({ keepAlive: event.target.value || null })}
              />
            </Field>
          </div>
        ) : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button type='button'>Done</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

const NumberField = ({
  label,
  description,
  value,
  min,
  max,
  step,
  onChange
}: {
  label: string
  description: string
  value?: number | null
  min?: number
  max?: number
  step?: number
  onChange: (value: number | null) => void
}) => (
  <Field
    label={label}
    description={description}
  >
    <Input
      type='number'
      value={value ?? ''}
      min={min}
      max={max}
      step={step}
      onChange={event => onChange(event.target.value === '' ? null : Number(event.target.value))}
    />
  </Field>
)
