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
import { useDialogPayload } from '@/hooks/use-dialog-payload'
import { checkAutomationAiProviderCandidateHealthAction } from '@/server/orchestrator/settings/actions'
import { AiHealthBadge } from '@/shared/ui/ai/ai-health-indicator'
import { ProviderConnectionFields } from './provider-connection-fields'
import { normalizeProviderForm, type ProviderFormState } from './provider-form-model'
import type { AutomationAiProviderHealth } from '@/shared/contracts/ai-provider'

export const ProviderDialog = ({
  provider: currentProvider,
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
  const { payload: provider, onOpenChangeComplete } = useDialogPayload(currentProvider)
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
      open={Boolean(currentProvider)}
      onOpenChangeComplete={onOpenChangeComplete}
      onOpenChange={open => {
        if (!open && !isSaving && !isCheckingHealth) onClose()
      }}
    >
      <DialogContent
        data-editor-dialog=''
        className='max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl'
      >
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <GradientSparklesIcon className='size-5' />
            Add AI provider
          </DialogTitle>
          <DialogDescription>
            Connect your model server, then choose which models to make available for automation.
          </DialogDescription>
        </DialogHeader>
        {provider ? (
          <fieldset
            disabled={isSaving || isCheckingHealth}
            className='grid min-w-0 gap-5'
          >
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
                <MutationButton
                  type='button'
                  variant='secondary'
                  pending={isCheckingHealth}
                  pendingLabel='Checking connection…'
                  onClick={() => void checkHealth()}
                >
                  <IconRefresh className={isCheckingHealth ? 'size-4 animate-spin' : 'size-4'} />
                  Check connection
                </MutationButton>
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
                  disabled={isSaving || isCheckingHealth}
                  onCheckedChange={enabled => update({ enabled })}
                />
              </FormField>
            </div>
          </fieldset>
        ) : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button
              type='button'
              variant='secondary'
              disabled={isSaving || isCheckingHealth}
            >
              Cancel
            </Button>
          </DialogClose>
          <MutationButton
            type='button'
            pending={isSaving}
            pendingLabel='Saving…'
            disabled={isCheckingHealth || !provider?.id.trim() || !provider.baseUrl.trim()}
            onClick={onSave}
          >
            Create provider
          </MutationButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
