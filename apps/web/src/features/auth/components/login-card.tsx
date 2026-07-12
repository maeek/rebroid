'use client'

import { useState } from 'react'
import { IconAlertTriangle, IconArrowLeft, IconLoader2, IconLockAccess } from '@tabler/icons-react'
import { signIn } from 'next-auth/react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Visible } from '@/components/ui/visible'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { beginLoginAction } from '@/server/users/actions/begin-login-action'
import { unwrapActionResult } from '@/shared/actions/action-result'

const requiredPasswordChangePath = '/account/required-password-change'

export default function LoginCard({
  navigate = path => window.location.assign(path)
}: {
  navigate?: (path: string) => void
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [step, setStep] = useState<'credentials' | 'mfa'>('credentials')
  const [postLoginPath, setPostLoginPath] = useState('/apps')

  const completeSignIn = async (authenticationCode: string | undefined, destination: string) => {
    const result = await signIn('credentials', {
      username,
      password,
      mfaCode: authenticationCode,
      redirect: false
    })

    if (result?.error) {
      throw new Error(
        step === 'mfa' ? 'The authentication code is incorrect.' : 'The username or password is incorrect.'
      )
    }

    navigate(destination)
  }

  const submitCredentials = async () => {
    if (!username || !password) {
      setError('Enter your username and password.')
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      const result = unwrapActionResult(await beginLoginAction({ username, password }))
      const destination = result.passwordChangeRequired ? requiredPasswordChangePath : '/apps'
      if (result.mfaRequired) {
        setPostLoginPath(destination)
        setStep('mfa')
        return
      }
      await completeSignIn(undefined, destination)
    } catch (submitError) {
      setError(getDisplayErrorMessage(submitError, 'Login failed. Refresh the page and try again.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const submitMfaCode = async () => {
    if (!mfaCode.trim()) {
      setError('Enter your authentication or recovery code.')
      return
    }
    setIsSubmitting(true)
    setError(null)
    try {
      await completeSignIn(mfaCode, postLoginPath)
    } catch (submitError) {
      setError(getDisplayErrorMessage(submitError, 'Could not verify the authentication code.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const returnToCredentials = () => {
    setStep('credentials')
    setPassword('')
    setMfaCode('')
    setError(null)
  }

  return (
    <>
      <Card className='mx-auto w-full max-w-md border-white/10 bg-surface-panel/58 shadow-emphasis backdrop-blur-xl max-sm:border-0 max-sm:border-transparent! max-sm:bg-transparent! max-sm:shadow-none! max-sm:backdrop-blur-none! max-sm:rounded-none! max-sm:mx-0 max-sm:max-w-full'>
        <CardHeader className='max-sm:px-0 flex-row gap-4 items-start'>
          <div className='flex size-14 items-center justify-center rounded-panel border border-primary/30 bg-primary/15 text-primary'>
            <IconLockAccess className='size-10' />
          </div>
          <div>
            <CardTitle className='text-2xl'>{step === 'mfa' ? 'Two-factor authentication' : 'Login'}</CardTitle>
            <CardDescription>
              {step === 'mfa' ? 'Enter the code from your authenticator.' : 'Access your Rebroid workspace.'}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className='max-sm:px-0'>
          {step === 'credentials' ? (
            <>
              <div className='flex w-full flex-col gap-4 pt-2'>
                <Label
                  className='text-md'
                  htmlFor='username'
                >
                  Username <span className='text-xs font-medium text-foreground-muted'>* (Required)</span>
                </Label>
                <Input
                  id='username'
                  placeholder='Username'
                  required
                  aria-required='true'
                  autoComplete='username'
                  onChange={event => setUsername(event.target.value)}
                  value={username}
                  onKeyDown={event => {
                    if (event.key === 'Enter') document.querySelector<HTMLInputElement>('#password')?.focus()
                  }}
                />
              </div>
              <div className='flex w-full flex-col gap-4 pb-4 pt-5'>
                <Label
                  className='text-md'
                  htmlFor='password'
                >
                  Password <span className='text-xs font-medium text-foreground-muted'>* (Required)</span>
                </Label>
                <Input
                  id='password'
                  type='password'
                  required
                  aria-required='true'
                  autoComplete='current-password'
                  placeholder='········'
                  className='placeholder:text-lg placeholder:font-bold'
                  onChange={event => setPassword(event.target.value)}
                  value={password}
                  onKeyDown={event => event.key === 'Enter' && void submitCredentials()}
                />
              </div>
            </>
          ) : (
            <div className='flex w-full flex-col gap-4 pb-4 pt-2'>
              <Label
                className='text-md'
                htmlFor='mfa-code'
              >
                Authentication or recovery code
              </Label>
              <Input
                id='mfa-code'
                inputMode='numeric'
                autoComplete='one-time-code'
                placeholder='123456 or recovery code'
                value={mfaCode}
                onChange={event => setMfaCode(event.target.value)}
                onKeyDown={event => event.key === 'Enter' && void submitMfaCode()}
              />
            </div>
          )}
        </CardContent>
        <CardFooter className='max-sm:px-0'>
          <div className='flex w-full flex-col'>
            <Visible when={!!error}>
              <Alert
                variant='danger'
                className='mb-5 bg-danger/15'
              >
                <IconAlertTriangle className='size-4' />
                <AlertTitle>Could not sign in</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </Visible>
            <Button
              className='w-full font-bold'
              size='lg'
              disabled={isSubmitting}
              onClick={() => void (step === 'mfa' ? submitMfaCode() : submitCredentials())}
            >
              {isSubmitting ? <IconLoader2 className='mr-2 size-4 animate-spin' /> : null}
              {step === 'mfa' ? 'Verify' : 'Login'}
            </Button>
            {step === 'mfa' ? (
              <Button
                className='mt-2 w-full'
                variant='ghost'
                disabled={isSubmitting}
                onClick={returnToCredentials}
              >
                <IconArrowLeft className='size-4' />
                Use another account
              </Button>
            ) : null}
          </div>
        </CardFooter>
      </Card>
    </>
  )
}
