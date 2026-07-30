'use client'

import { FormEvent, useState } from 'react'
import { IconAlertTriangle, IconLockAccess, IconLogout } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { signIn, signOut } from 'next-auth/react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { MutationButton } from '@/components/ui/mutation-button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { completeRequiredPasswordChangeAction } from '@/server/users/actions/complete-required-password-change-action'
import { unwrapActionResult } from '@/shared/actions/action-result'

export const RequiredPasswordChangePageClient = ({
  displayName,
  username,
  passwordMinimumLength
}: {
  displayName: string
  username: string
  passwordMinimumLength: number
}) => {
  const router = useRouter()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
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
        username,
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

  return (
    <Card className='relative z-10 mx-auto w-full max-w-md border-white/10 bg-surface-panel/70 shadow-emphasis backdrop-blur-xl max-sm:border-0 max-sm:bg-transparent max-sm:shadow-none max-sm:backdrop-blur-none'>
      <CardHeader className='flex-row items-start gap-4 max-sm:px-0'>
        <div className='flex size-14 items-center justify-center rounded-panel border border-primary/30 bg-primary/15 text-primary'>
          <IconLockAccess className='size-10' />
        </div>
        <div>
          <CardTitle className='text-2xl'>Change password</CardTitle>
          <CardDescription>{displayName}, set a new password to continue.</CardDescription>
        </div>
      </CardHeader>
      <form onSubmit={event => void submit(event)}>
        <CardContent className='grid gap-5 max-sm:px-0'>
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
            description={`Use at least ${passwordMinimumLength} characters.`}
          >
            <Input
              type='password'
              autoComplete='new-password'
              required
              minLength={passwordMinimumLength}
              placeholder={`Minimum ${passwordMinimumLength} characters`}
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
            <Alert
              variant='danger'
              className='bg-danger/15'
            >
              <IconAlertTriangle className='size-4' />
              <AlertTitle>Could not change password</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
        <CardFooter className='grid gap-3 max-sm:px-0'>
          <MutationButton
            type='submit'
            size='lg'
            className='w-full font-bold'
            pending={isSubmitting}
            pendingLabel='Updating…'
          >
            Update password
          </MutationButton>
          <Button
            type='button'
            variant='secondary'
            className='w-full'
            disabled={isSubmitting}
            onClick={() => void signOut({ callbackUrl: '/login', redirect: true })}
          >
            <IconLogout className='size-4' />
            Sign out
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

export const RequiredPasswordChangePageLoading = () => (
  <Card className='relative z-10 mx-auto w-full max-w-md border-white/10 bg-surface-panel/70 shadow-emphasis backdrop-blur-xl max-sm:border-0 max-sm:bg-transparent max-sm:shadow-none max-sm:backdrop-blur-none'>
    <CardHeader className='flex-row items-start gap-4 max-sm:px-0'>
      <div className='flex size-14 items-center justify-center rounded-panel border border-primary/30 bg-primary/15 text-primary'>
        <IconLockAccess className='size-10' />
      </div>
      <div className='grid flex-1 gap-2'>
        <CardTitle className='text-2xl'>Change password</CardTitle>
        <Skeleton className='h-4 w-52 max-w-full' />
      </div>
    </CardHeader>
    <CardContent className='grid gap-5 max-sm:px-0'>
      {Array.from({ length: 3 }, (_, index) => (
        <div
          key={index}
          className='grid gap-2'
        >
          <Skeleton className='h-4 w-28' />
          <Skeleton className='h-9 w-full' />
        </div>
      ))}
    </CardContent>
    <CardFooter className='grid gap-3 max-sm:px-0'>
      <Button
        size='lg'
        className='w-full'
        disabled
      >
        Update password
      </Button>
      <Button
        variant='secondary'
        className='w-full'
        disabled
      >
        Sign out
      </Button>
    </CardFooter>
  </Card>
)
