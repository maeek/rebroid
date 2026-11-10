'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { MutationButton } from '@/components/ui/mutation-button'
import { Section } from '@/components/ui/section'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { changeCurrentPasswordAction } from '@/server/users/actions/change-current-password-action'
import { unwrapActionResult } from '@/shared/actions/action-result'

export const AccountPasswordSettings = ({ loading = false }: { loading?: boolean }) => {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const disabled = loading || isChangingPassword

  const changePassword = async () => {
    if (newPassword !== confirmNewPassword) {
      toast({ title: 'Could not change password', description: 'New passwords do not match.', variant: 'danger' })
      return
    }

    setIsChangingPassword(true)
    try {
      unwrapActionResult(await changeCurrentPasswordAction({ currentPassword, newPassword }))
      toast({ title: 'Password changed', description: 'Log in again with your new password.', variant: 'success' })
      await signOut({ callbackUrl: '/login', redirect: true })
    } catch (error) {
      toast({
        title: 'Could not change password',
        description: getDisplayErrorMessage(error),
        variant: 'danger'
      })
    } finally {
      setIsChangingPassword(false)
    }
  }

  return (
    <Section
      surface='plain'
      headingLevel={3}
      title='Change password'
      description='Confirm your current password before setting a new one.'
    >
      <FormField
        label='Current password'
        layout='vertical'
      >
        <Input
          type='password'
          autoComplete='current-password'
          disabled={disabled}
          value={currentPassword}
          onChange={event => setCurrentPassword(event.target.value)}
        />
      </FormField>
      <div className='grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2'>
        <FormField
          label='New password'
          layout='vertical'
        >
          <Input
            type='password'
            autoComplete='new-password'
            disabled={disabled}
            value={newPassword}
            onChange={event => setNewPassword(event.target.value)}
          />
        </FormField>
        <FormField
          label='Confirm new password'
          layout='vertical'
        >
          <Input
            type='password'
            autoComplete='new-password'
            disabled={disabled}
            value={confirmNewPassword}
            onChange={event => setConfirmNewPassword(event.target.value)}
          />
        </FormField>
      </div>
      <MutationButton
        className='self-start'
        variant='secondary'
        pending={isChangingPassword}
        pendingLabel='Changing password…'
        disabled={loading || !currentPassword || !newPassword || !confirmNewPassword}
        onClick={() => void changePassword()}
      >
        Change password
      </MutationButton>
    </Section>
  )
}
