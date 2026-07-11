'use client'

import { FormEvent, useState } from 'react'
import { IconAlertTriangle, IconLoader2, IconLockAccess, IconLogout } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { signIn, signOut } from 'next-auth/react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
      toast({ title: 'Password updated' })
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
          <div className='grid gap-3'>
            <Label htmlFor='current-password'>Current password</Label>
            <Input
              id='current-password'
              type='password'
              autoComplete='current-password'
              required
              value={currentPassword}
              onChange={event => setCurrentPassword(event.target.value)}
            />
          </div>
          <div className='grid gap-3'>
            <Label htmlFor='new-password'>New password</Label>
            <Input
              id='new-password'
              type='password'
              autoComplete='new-password'
              required
              minLength={passwordMinimumLength}
              placeholder={`Minimum ${passwordMinimumLength} characters`}
              value={newPassword}
              onChange={event => setNewPassword(event.target.value)}
            />
          </div>
          <div className='grid gap-3'>
            <Label htmlFor='confirm-password'>Confirm password</Label>
            <Input
              id='confirm-password'
              type='password'
              autoComplete='new-password'
              required
              minLength={passwordMinimumLength}
              value={confirmPassword}
              onChange={event => setConfirmPassword(event.target.value)}
            />
          </div>
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
          <Button
            type='submit'
            size='lg'
            className='w-full font-bold'
            disabled={isSubmitting}
          >
            {isSubmitting ? <IconLoader2 className='mr-2 size-4 animate-spin' /> : null}
            Update password
          </Button>
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
