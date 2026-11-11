'use client'

import { useRef, useState } from 'react'
import { IconArrowLeft } from '@tabler/icons-react'
import { signIn } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { MutationButton } from '@/components/ui/mutation-button'
import { Notice } from '@/components/ui/notice'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { beginLoginAction } from '@/server/users/actions/begin-login-action'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { AuthPanel } from './auth-panel'

const requiredPasswordChangePath = '/account/required-password-change'

export default function LoginCard({
  navigate = path => window.location.assign(path)
}: {
  navigate?: (path: string) => void
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const passwordInput = useRef<HTMLInputElement>(null)
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
    <AuthPanel
      title={step === 'mfa' ? 'Verify your identity' : 'Sign in'}
      description={step === 'mfa' ? 'Use your authenticator app or a recovery code.' : undefined}
    >
      <form
        className='grid gap-5'
        noValidate
        onSubmit={event => {
          event.preventDefault()
          if (!isSubmitting) void (step === 'mfa' ? submitMfaCode() : submitCredentials())
        }}
      >
        {step === 'credentials' ? (
          <>
            <FormField
              layout='vertical'
              label='Username'
            >
              <Input
                name='username'
                required
                autoComplete='username'
                onChange={event => setUsername(event.target.value)}
                value={username}
                onKeyDown={event => {
                  if (event.key !== 'Enter') return
                  event.preventDefault()
                  passwordInput.current?.focus()
                }}
              />
            </FormField>
            <FormField
              layout='vertical'
              label='Password'
            >
              <Input
                name='password'
                ref={passwordInput}
                type='password'
                required
                autoComplete='current-password'
                onChange={event => setPassword(event.target.value)}
                value={password}
              />
            </FormField>
          </>
        ) : (
          <FormField
            layout='vertical'
            label='Authentication or recovery code'
          >
            <Input
              name='mfa-code'
              required
              inputMode='numeric'
              autoComplete='one-time-code'
              value={mfaCode}
              onChange={event => setMfaCode(event.target.value)}
            />
          </FormField>
        )}
        {error ? (
          <Notice
            tone='danger'
            description={error}
            className='break-words'
          />
        ) : null}
        <div className='grid gap-2'>
          <MutationButton
            type='submit'
            pending={isSubmitting}
            pendingLabel={step === 'mfa' ? 'Verifying…' : 'Signing in…'}
            size='lg'
          >
            {step === 'mfa' ? 'Verify' : 'Sign in'}
          </MutationButton>
          {step === 'mfa' ? (
            <Button
              type='button'
              variant='ghost'
              disabled={isSubmitting}
              onClick={returnToCredentials}
            >
              <IconArrowLeft className='size-4' />
              Use another account
            </Button>
          ) : null}
        </div>
      </form>
    </AuthPanel>
  )
}
