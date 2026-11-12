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
import { Section } from '@/components/ui/section'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useDialogPayload } from '@/hooks/use-dialog-payload'
import { ProviderModelPurposes } from './provider-model-purposes'
import { ProviderNumberField } from './provider-number-field'
import type { ProviderModelRow } from './provider-form-model'
import type { AutomationAiProvider, AutomationAiProviderModel } from '@/shared/contracts/ai-provider'

export const ProviderModelSettingsDialog = ({
  model: currentModel,
  provider,
  onClose,
  onChange
}: {
  model: ProviderModelRow | null
  provider: Pick<AutomationAiProvider, 'kind' | 'protocol'>
  onClose: () => void
  onChange: (index: number, patch: Partial<AutomationAiProviderModel>) => void
}) => {
  const { payload: model, onOpenChangeComplete } = useDialogPayload(currentModel)
  const settings = model?.settings ?? {}
  const openAi = provider.kind === 'openai'
  const nativeOllama = provider.protocol === 'ollama-native-chat'
  const updateSettings = (patch: Partial<AutomationAiProviderModel['settings']>) => {
    if (!model) return
    onChange(model.index, { settings: { ...settings, ...patch } })
  }

  return (
    <Dialog
      open={Boolean(currentModel)}
      onOpenChangeComplete={onOpenChangeComplete}
      onOpenChange={open => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        data-editor-dialog=''
        className={
          openAi
            ? 'flex flex-col overflow-hidden sm:max-w-xl'
            : 'flex flex-col overflow-hidden sm:max-w-3xl lg:max-w-4xl'
        }
      >
        <DialogHeader className='shrink-0 pr-6'>
          <DialogTitle className='flex items-center gap-2'>
            <GradientSparklesIcon className='size-5' />
            Model settings
          </DialogTitle>
          <DialogDescription>
            Choose how Rebroid uses this model. Changes apply when you save the provider.
          </DialogDescription>
        </DialogHeader>
        {model ? (
          <div className='scrollbar-thin grid min-h-0 min-w-0 content-start gap-6 overflow-y-auto px-1 py-1'>
            <div className='grid items-start gap-4'>
              <FormField
                controlId='provider-model-display-name'
                label='Display name'
                layout='vertical'
                description={<span className='font-mono wrap-anywhere'>{model.id}</span>}
              >
                <Input
                  value={model.label}
                  onChange={event => onChange(model.index, { label: event.target.value })}
                />
              </FormField>
              <ProviderModelPurposes
                roles={model.roles}
                onChange={roles => onChange(model.index, { roles })}
              />
            </div>
            <Section
              surface='plain'
              title={openAi ? 'Custom instructions' : 'Advanced generation settings'}
              description={openAi ? undefined : 'Use overrides supported by your server.'}
              collapsible
            >
              <FormField
                controlId='provider-model-system-prompt'
                label='System prompt'
                description='Optional instructions for this model when it drafts or runs automations.'
                layout='vertical'
              >
                <Textarea
                  value={settings.systemPrompt ?? ''}
                  rows={5}
                  onChange={event => updateSettings({ systemPrompt: event.target.value || null })}
                />
              </FormField>
              {!openAi ? (
                <div className='grid gap-x-form-column gap-y-4 sm:grid-cols-2'>
                  <FormField
                    controlId='provider-model-thinking-mode'
                    label='Thinking mode'
                    description={
                      nativeOllama
                        ? 'Choose whether the model thinks before answering.'
                        : 'Bound or disable reasoning on compatible servers.'
                    }
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
                        <SelectItem value='bounded'>{nativeOllama ? 'Enabled' : 'Bounded'}</SelectItem>
                        <SelectItem value='provider-default'>Provider default</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>
                  {!nativeOllama ? (
                    <ProviderNumberField
                      controlId='provider-model-reasoning-budget'
                      label='Reasoning budget'
                      description='Maximum hidden reasoning tokens when bounded mode is selected.'
                      value={settings.reasoningBudgetTokens}
                      min={0}
                      max={32768}
                      step={64}
                      onChange={reasoningBudgetTokens => updateSettings({ reasoningBudgetTokens })}
                      disabled={settings.thinkingMode !== 'bounded'}
                    />
                  ) : null}
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
                  {nativeOllama ? (
                    <>
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
                    </>
                  ) : null}
                </div>
              ) : null}
              {!openAi && nativeOllama ? (
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
              ) : null}
            </Section>
          </div>
        ) : null}
        <DialogFooter className='shrink-0'>
          <DialogClose asChild>
            <Button type='button'>Done</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
