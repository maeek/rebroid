'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { MutationButton } from '@/components/ui/mutation-button'
import { Section } from '@/components/ui/section'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { beginMfaSetupAction, confirmMfaSetupAction, disableMfaAction } from '@/server/users/actions/mfa-actions'
import { unwrapActionResult } from '@/shared/actions/action-result'

export const AccountMfaSettings = ({
  initialEnabled,
  loading = false
}: {
  initialEnabled: boolean
  loading?: boolean
}) => {
  const [mfaEnabled, setMfaEnabled] = useState(initialEnabled)
  const [mfaPassword, setMfaPassword] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [mfaSecret, setMfaSecret] = useState<string | null>(null)
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [isUpdatingMfa, setIsUpdatingMfa] = useState(false)

  const beginMfaSetup = async () => {
    setIsUpdatingMfa(true)
    try {
      const setup = unwrapActionResult(await beginMfaSetupAction(mfaPassword))
      setMfaSecret(setup.secret)
      setMfaPassword('')
      setMfaCode('')
    } catch (error) {
      toast({ title: 'Could not start MFA setup', description: getDisplayErrorMessage(error), variant: 'danger' })
    } finally {
      setIsUpdatingMfa(false)
    }
  }

  const confirmMfaSetup = async () => {
    setIsUpdatingMfa(true)
    try {
      const result = unwrapActionResult(await confirmMfaSetupAction(mfaCode))
      setMfaEnabled(true)
      setMfaSecret(null)
      setMfaCode('')
      setRecoveryCodes(result.recoveryCodes)
      toast({ title: 'Multi-factor authentication enabled', variant: 'success' })
    } catch (error) {
      toast({ title: 'Could not enable MFA', description: getDisplayErrorMessage(error), variant: 'danger' })
    } finally {
      setIsUpdatingMfa(false)
    }
  }

  const disableMfa = async () => {
    setIsUpdatingMfa(true)
    try {
      unwrapActionResult(await disableMfaAction({ currentPassword: mfaPassword, code: mfaCode }))
      toast({
        title: 'Multi-factor authentication disabled',
        description: 'Log in again to continue.',
        variant: 'success'
      })
      await signOut({ callbackUrl: '/login', redirect: true })
    } catch (error) {
      toast({ title: 'Could not disable MFA', description: getDisplayErrorMessage(error), variant: 'danger' })
    } finally {
      setIsUpdatingMfa(false)
    }
  }

  return (
    <Section
      surface='plain'
      title='Multi-factor authentication'
      description='Use an authenticator app. Each recovery code works once.'
    >
      {recoveryCodes.length > 0 ? (
        <div className='grid gap-2 rounded-panel border border-warning/30 bg-warning/10 p-3 text-sm'>
          <p>Save these recovery codes now. They will not be shown again.</p>
          <code className='grid gap-1'>
            {recoveryCodes.map(code => (
              <span key={code}>{code}</span>
            ))}
          </code>
          <Button
            variant='secondary'
            onClick={() => void signOut({ callbackUrl: '/login', redirect: true })}
          >
            Finish and sign in again
          </Button>
        </div>
      ) : (
        <>
          {!mfaSecret ? (
            <FormField
              label='Current password'
              layout='vertical'
            >
              <Input
                type='password'
                disabled={loading || isUpdatingMfa}
                autoComplete='current-password'
                value={mfaPassword}
                onChange={event => setMfaPassword(event.target.value)}
              />
            </FormField>
          ) : null}
          {mfaSecret ? (
            <div className='grid gap-2'>
              <p className='text-sm'>
                Add this key to your authenticator: <code className='break-all'>{mfaSecret}</code>
              </p>
              <FormField
                label='Authentication code'
                layout='vertical'
              >
                <Input
                  inputMode='numeric'
                  autoComplete='one-time-code'
                  disabled={loading || isUpdatingMfa}
                  value={mfaCode}
                  onChange={event => setMfaCode(event.target.value)}
                />
              </FormField>
              <MutationButton
                className='self-start'
                variant='secondary'
                pending={isUpdatingMfa}
                pendingLabel='Verifying…'
                disabled={loading || !mfaCode}
                onClick={() => void confirmMfaSetup()}
              >
                Verify and enable
              </MutationButton>
            </div>
          ) : mfaEnabled ? (
            <>
              <FormField
                label='Authentication or recovery code'
                layout='vertical'
              >
                <Input
                  autoComplete='one-time-code'
                  disabled={loading || isUpdatingMfa}
                  value={mfaCode}
                  onChange={event => setMfaCode(event.target.value)}
                />
              </FormField>
              <MutationButton
                className='self-start'
                variant='secondary'
                pending={isUpdatingMfa}
                pendingLabel='Disabling…'
                disabled={loading || !mfaPassword || !mfaCode}
                onClick={() => void disableMfa()}
              >
                Disable MFA
              </MutationButton>
            </>
          ) : (
            <MutationButton
              className='self-start'
              variant='secondary'
              pending={isUpdatingMfa}
              pendingLabel='Starting setup…'
              disabled={loading || !mfaPassword}
              onClick={() => void beginMfaSetup()}
            >
              Set up MFA
            </MutationButton>
          )}
        </>
      )}
    </Section>
  )
}
