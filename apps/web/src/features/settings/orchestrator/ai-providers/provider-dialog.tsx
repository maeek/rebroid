import { useState } from 'react'
import { IconRefresh } from '@tabler/icons-react'
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
import { MutationButton } from '@/components/ui/mutation-button'
import { Switch } from '@/components/ui/switch'
import { checkAutomationAiProviderCandidateHealthAction } from '@/server/orchestrator/settings/actions'
import { AiHealthBadge } from '@/shared/ui/ai/ai-health-indicator'
import { ProviderConnectionFields } from './provider-connection-fields'
import { normalizeProviderForm, type ProviderFormState } from './provider-form-model'
import type { AutomationAiProviderHealth } from '@/shared/contracts/ai-provider'

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
  const [health, setHealth] = useState<AutomationAiProviderHealth | null>(null)
  const [isCheckingHealth, setIsCheckingHealth] = useState(false)
  const update = (patch: Partial<ProviderFormState>) => {
    if (!provider) return
    onChange({ ...provider, ...patch })
    setHealth(null)
  }

  const checkHealth = async () => {
    if (!provider) return
    setIsCheckingHealth(true)
    try {
      setHealth(await checkAutomationAiProviderCandidateHealthAction(normalizeProviderForm(provider)))
    } catch (error) {
      setHealth({
        providerId: provider.id,
        status: 'error',
        message: error instanceof Error ? error.message : 'Connection check failed.',
        checkedAt: new Date().toISOString()
      })
    } finally {
      setIsCheckingHealth(false)
    }
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
          <DialogTitle className='flex items-center gap-2'>
            <GradientSparklesIcon className='size-5' />
            Add AI provider
          </DialogTitle>
          <DialogDescription>
            Configure the provider connection first. Add models from the provider editor after it is created.
          </DialogDescription>
        </DialogHeader>
        {provider ? (
          <div className='grid gap-5'>
            <div className='grid gap-4'>
              <ProviderConnectionFields
                provider={provider}
                mode='create'
                onChange={update}
              />
              <div className='flex flex-wrap items-center justify-between gap-3'>
                <div className='flex min-w-0 flex-wrap items-center gap-3'>
                  {health ? (
                    <>
                      <AiHealthBadge
                        health={health}
                        isChecking={isCheckingHealth}
                      />
                      <span className='min-w-0 break-words text-sm text-foreground-muted'>{health.message}</span>
                    </>
                  ) : (
                    <span className='text-sm text-foreground-muted'>Check the provider before saving.</span>
                  )}
                </div>
                <Button
                  type='button'
                  variant='secondary'
                  disabled={isCheckingHealth}
                  onClick={() => void checkHealth()}
                >
                  <IconRefresh className={isCheckingHealth ? 'size-4 animate-spin' : 'size-4'} />
                  Check connection
                </Button>
              </div>
              <FormField
                controlId='provider-create-enabled'
                label='Enabled'
                description='Keep disabled until at least one usable model is configured.'
                layout='horizontal'
              >
                <Switch
                  className='shrink-0'
                  checked={provider.enabled}
                  onCheckedChange={enabled => update({ enabled })}
                />
              </FormField>
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
          <MutationButton
            type='button'
            pending={isSaving}
            pendingLabel='Saving…'
            onClick={onSave}
          >
            Save
          </MutationButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
