import { useState } from 'react'
import { IconDeviceFloppy } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { NumberSliderField } from '@/components/ui/number-slider-field'
import { Section } from '@/components/ui/section'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { saveWebSettingsAction } from '@/server/web-settings/actions/save-web-settings-action'
import { unwrapActionResult } from '@/shared/actions/action-result'

type PasswordPolicySectionProps = {
  initialPasswordMinimumLength: number
}

export const PasswordPolicySection = ({ initialPasswordMinimumLength }: PasswordPolicySectionProps) => {
  const [passwordMinimumLength, setPasswordMinimumLength] = useState(initialPasswordMinimumLength)
  const [isSavingPasswordPolicy, setIsSavingPasswordPolicy] = useState(false)

  const savePasswordPolicy = async () => {
    setIsSavingPasswordPolicy(true)
    try {
      const saved = unwrapActionResult(await saveWebSettingsAction({ passwordMinimumLength }))
      setPasswordMinimumLength(saved.passwordMinimumLength)
      toast({ title: 'Password policy saved' })
    } catch (error) {
      toast({
        title: 'Could not save password policy',
        description: getDisplayErrorMessage(error),
        variant: 'danger'
      })
    } finally {
      setIsSavingPasswordPolicy(false)
    }
  }

  return (
    <Section
      surface='plain'
      title='Password policy'
      titleClassName='pb-2'
      contentClassName='gap-3'
    >
      <FormField
        label='Minimum password length'
        description='Applies to new users, admin password resets, and profile password changes.'
        layout='vertical'
        className='flex-col items-start w-full'
      >
        <div className='flex w-full flex-wrap items-end gap-3'>
          <div className='w-full max-w-md'>
            <NumberSliderField
              value={String(passwordMinimumLength)}
              min={8}
              max={128}
              inputSuffix='characters'
              showSlider={false}
              onValueChange={value => setPasswordMinimumLength(Number(value) || initialPasswordMinimumLength)}
            />
          </div>
          <Button
            type='button'
            disabled={isSavingPasswordPolicy}
            onClick={() => void savePasswordPolicy()}
          >
            <IconDeviceFloppy className='size-4' />
            Save Policy
          </Button>
        </div>
      </FormField>
    </Section>
  )
}
