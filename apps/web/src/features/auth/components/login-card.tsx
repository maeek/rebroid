'use client'

import { useState } from 'react'
import { IconArrowLeft } from '@tabler/icons-react'
import { signIn } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { MutationButton } from '@/components/ui/mutation-button'
import { Notice } from '@/components/ui/notice'
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
    <div className='mx-auto flex w-full max-w-md flex-col gap-4 max-sm:mx-0 max-sm:max-w-full'>
      <Card className='w-full border-surface-border bg-surface-panel shadow-none max-sm:border-0 max-sm:border-transparent! max-sm:bg-transparent! max-sm:shadow-none! max-sm:backdrop-blur-none! max-sm:rounded-none! max-sm:mx-0 max-sm:max-w-full'>
        <CardHeader className='max-sm:px-0 gap-2'>
          <CardTitle className='text-2xl font-medium tracking-tight'>
            {step === 'mfa' ? 'Verify your identity' : 'Sign in'}
          </CardTitle>
          <CardDescription>
            {step === 'mfa' ? 'Enter your authentication or recovery code.' : 'Continue to your Rebroid workspace.'}
          </CardDescription>
        </CardHeader>
        <CardContent className='max-sm:px-0'>
          {step === 'credentials' ? (
            <>
              <FormField
                layout='vertical'
                controlId='username'
                label='Username'
                className='gap-2 pt-2'
              >
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
              </FormField>
              <FormField
                layout='vertical'
                controlId='password'
                label='Password'
                className='gap-2 pb-1 pt-5'
              >
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
              </FormField>
            </>
          ) : (
            <FormField
              layout='vertical'
              controlId='mfa-code'
              label='Authentication or recovery code'
              className='gap-2 pt-2'
            >
              <Input
                id='mfa-code'
                inputMode='numeric'
                autoComplete='one-time-code'
                placeholder='123456 or recovery code'
                value={mfaCode}
                onChange={event => setMfaCode(event.target.value)}
                onKeyDown={event => event.key === 'Enter' && void submitMfaCode()}
              />
            </FormField>
          )}
        </CardContent>
        <CardFooter className='max-sm:px-0'>
          <div className='flex w-full flex-col'>
            <MutationButton
              pending={isSubmitting}
              pendingLabel={step === 'mfa' ? 'Verifying…' : 'Signing in…'}
              className='w-full'
              size='lg'
              disabled={isSubmitting}
              onClick={() => void (step === 'mfa' ? submitMfaCode() : submitCredentials())}
            >
              {step === 'mfa' ? 'Verify' : 'Sign in'}
            </MutationButton>
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
      <Visible when={!!error}>
        <Notice
          tone='danger'
          className='break-words'
        >
          {error}
        </Notice>
      </Visible>
    </div>
  )
}
