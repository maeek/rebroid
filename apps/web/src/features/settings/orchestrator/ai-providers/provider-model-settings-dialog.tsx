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
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ProviderNumberField } from './provider-number-field'
import type { ProviderModelRow } from './provider-form-model'
import type { AutomationAiProviderModel } from '@/shared/contracts/ai-provider'

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
            <FormField
              controlId='provider-model-system-prompt'
              label='System prompt'
              description='Additional system instructions appended to AI automation runs for this model.'
              layout='vertical'
            >
              <Textarea
                value={settings.systemPrompt ?? ''}
                rows={5}
                onChange={event => updateSettings({ systemPrompt: event.target.value || null })}
              />
            </FormField>
            <div className='grid gap-4 sm:grid-cols-2'>
              <FormField
                controlId='provider-model-thinking-mode'
                label='Thinking mode'
                description='Bound or disable hidden reasoning for latency-sensitive controller turns.'
                layout='vertical'
              >
                <Select
                  value={settings.thinkingMode ?? 'provider-default'}
                  onValueChange={thinkingMode =>
                    updateSettings({
                      thinkingMode
                    })
                  }
                >
                  <SelectTrigger
                    id='provider-model-thinking-mode'
                    className='w-full'
                    aria-describedby='provider-model-thinking-mode-description'
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='disabled'>Disabled</SelectItem>
                    <SelectItem value='bounded'>Bounded</SelectItem>
                    <SelectItem value='provider-default'>Provider default</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <ProviderNumberField
                controlId='provider-model-reasoning-budget'
                label='Reasoning budget'
                description='Maximum hidden reasoning tokens when bounded mode is selected.'
                value={settings.reasoningBudgetTokens}
                min={0}
                max={32768}
                step={64}
                onChange={reasoningBudgetTokens => updateSettings({ reasoningBudgetTokens })}
              />
              <ProviderNumberField
                controlId='provider-model-temperature'
                label='Temperature'
                description='Sampling randomness from 0 to 2.'
                value={settings.temperature}
                min={0}
                max={2}
                step={0.1}
                onChange={temperature => updateSettings({ temperature })}
              />
              <ProviderNumberField
                controlId='provider-model-top-p'
                label='Top P'
                description='Nucleus sampling value from 0 to 1.'
                value={settings.topP}
                min={0}
                max={1}
                step={0.05}
                onChange={topP => updateSettings({ topP })}
              />
              <ProviderNumberField
                controlId='provider-model-top-k'
                label='Top K'
                description='Ollama top-k sampling limit.'
                value={settings.topK}
                min={0}
                max={500}
                step={1}
                onChange={topK => updateSettings({ topK })}
              />
              <ProviderNumberField
                controlId='provider-model-context-length'
                label='Context length'
                description='Ollama num_ctx option.'
                value={settings.numCtx}
                min={128}
                max={262144}
                step={128}
                onChange={numCtx => updateSettings({ numCtx })}
              />
              <ProviderNumberField
                controlId='provider-model-repeat-penalty'
                label='Repeat penalty'
                description='Ollama repeat_penalty option.'
                value={settings.repeatPenalty}
                min={0}
                max={4}
                step={0.05}
                onChange={repeatPenalty => updateSettings({ repeatPenalty })}
              />
              <ProviderNumberField
                controlId='provider-model-seed'
                label='Seed'
                description='Optional deterministic seed.'
                value={settings.seed}
                step={1}
                onChange={seed => updateSettings({ seed })}
              />
            </div>
            <FormField
              controlId='provider-model-keep-alive'
              label='Keep alive'
              description='Ollama keep_alive value such as 5m, 1h, or -1.'
              layout='vertical'
            >
              <Input
                value={settings.keepAlive ?? ''}
                placeholder='5m'
                onChange={event => updateSettings({ keepAlive: event.target.value || null })}
              />
            </FormField>
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
