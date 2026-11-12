'use client'

import { FormEvent, useState } from 'react'
import { IconLogout } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { signIn, signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { FormLoadingBoundary } from '@/components/ui/form-loading-boundary'
import { Input } from '@/components/ui/input'
import { MutationButton } from '@/components/ui/mutation-button'
import { Notice } from '@/components/ui/notice'
import { Skeleton } from '@/components/ui/skeleton'
import { AuthPanel } from '@/features/auth/components/auth-panel'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { completeRequiredPasswordChangeAction } from '@/server/users/actions/complete-required-password-change-action'
import { unwrapActionResult } from '@/shared/actions/action-result'

type RequiredPasswordChangeProps =
  { loading: true } | { loading?: false; displayName: string; username: string; passwordMinimumLength: number }

export const RequiredPasswordChangePageClient = (props: RequiredPasswordChangeProps) => {
  const router = useRouter()
  const passwordMinimumLength =
    props.loading || props.passwordMinimumLength <= 1 ? undefined : props.passwordMinimumLength
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (props.loading || isSubmitting) return
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Enter your current password and a new password.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.')
      return
    }

    setError(null)
    setIsSubmitting(true)
    try {
      unwrapActionResult(await completeRequiredPasswordChangeAction({ currentPassword, newPassword }))
      const signInResult = await signIn('credentials', {
        username: props.username,
        password: newPassword,
        redirect: false
      })
      if (!signInResult?.ok) {
        await signOut({ callbackUrl: '/login', redirect: true })
        return
      }
      toast({ title: 'Password updated', variant: 'success' })
      router.replace('/apps')
      router.refresh()
    } catch (submitError) {
      setError(getDisplayErrorMessage(submitError))
    } finally {
      setIsSubmitting(false)
    }
  }

  const form = (
    <form
      className='grid gap-5'
      onSubmit={event => void submit(event)}
    >
      <FormField
        controlId='current-password'
        label='Current password'
        layout='vertical'
      >
        <Input
          type='password'
          autoComplete='current-password'
          required
          value={currentPassword}
          onChange={event => setCurrentPassword(event.target.value)}
        />
      </FormField>
      <FormField
        controlId='new-password'
        label='New password'
        layout='vertical'
        description={
          props.loading ? (
            <Skeleton
              as='span'
              className='inline-block h-3 w-32'
            />
          ) : (
            passwordMinimumLength && `Use at least ${passwordMinimumLength} characters.`
          )
        }
      >
        <Input
          type='password'
          autoComplete='new-password'
          required
          minLength={passwordMinimumLength}
          value={newPassword}
          onChange={event => setNewPassword(event.target.value)}
        />
      </FormField>
      <FormField
        controlId='confirm-password'
        label='Confirm password'
        layout='vertical'
      >
        <Input
          type='password'
          autoComplete='new-password'
          required
          minLength={passwordMinimumLength}
          value={confirmPassword}
          onChange={event => setConfirmPassword(event.target.value)}
        />
      </FormField>
      {error ? (
        <Notice
          tone='danger'
          title='Could not change password'
          description={error}
        />
      ) : null}
      <div className='grid gap-2'>
        <MutationButton
          type='submit'
          size='lg'
          variant={props.loading ? 'secondary' : 'primary'}
          disabled={props.loading}
          pending={isSubmitting}
          pendingLabel='Updating…'
        >
          Update password
        </MutationButton>
        <Button
          type='button'
          variant='ghost'
          disabled={props.loading || isSubmitting}
          onClick={() => void signOut({ callbackUrl: '/login', redirect: true })}
        >
          <IconLogout className='size-4' />
          Sign out
        </Button>
      </div>
    </form>
  )

  return (
    <AuthPanel
      title='Change password'
      description={
        props.loading ? (
          <Skeleton className='h-5 w-52 max-w-full' />
        ) : (
          `${props.displayName}, set a new password to continue.`
        )
      }
    >
      {props.loading ? <FormLoadingBoundary>{form}</FormLoadingBoundary> : form}
    </AuthPanel>
  )
}
