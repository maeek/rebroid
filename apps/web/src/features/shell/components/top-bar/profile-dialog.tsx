'use client'

import { useCallback, useEffect, useState } from 'react'
import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { changeCurrentPasswordAction } from '@/server/users/actions/change-current-password-action'
import { beginMfaSetupAction, confirmMfaSetupAction, disableMfaAction } from '@/server/users/actions/mfa-actions'
import { updateCurrentAccentColorAction } from '@/server/users/actions/update-current-accent-color-action'
import { updateCurrentProfileAction } from '@/server/users/actions/update-current-profile-action'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { useAccentColorPreference } from '@/shared/model/theme/use-accent-color'
import { AccentColorPicker } from '@/shared/ui/settings/accent-color-picker'
import { UserAvatarInput } from '@/shared/ui/user-avatar/user-avatar-input'
import type { AccentColor } from '@/shared/model/theme/accent-color'

export const ProfileDialog = ({
  open,
  name,
  avatar,
  initialAccentColor,
  initialMfaEnabled,
  onOpenChange,
  onAvatarSaved
}: {
  open: boolean
  name: string
  avatar: string | null
  initialAccentColor: AccentColor
  initialMfaEnabled: boolean
  onOpenChange: (open: boolean) => void
  onAvatarSaved: (avatar: string | null) => void
}) => {
  const [draftAvatar, setDraftAvatar] = useState(avatar)
  const [isSavingAvatar, setIsSavingAvatar] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [mfaEnabled, setMfaEnabled] = useState(initialMfaEnabled)
  const [mfaPassword, setMfaPassword] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [mfaSecret, setMfaSecret] = useState<string | null>(null)
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [isUpdatingMfa, setIsUpdatingMfa] = useState(false)
  const saveAccentColor = useCallback(async (nextAccentColor: AccentColor) => {
    unwrapActionResult(await updateCurrentAccentColorAction(nextAccentColor))
  }, [])
  const { accentColor, setAccentColor } = useAccentColorPreference({
    initialAccentColor,
    saveAccentColor,
    onSaveError: error =>
      toast({
        title: 'Could not save accent color',
        description: getDisplayErrorMessage(error),
        variant: 'danger'
      })
  })

  useEffect(() => {
    setDraftAvatar(avatar)
  }, [avatar])

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmNewPassword('')
      setMfaPassword('')
      setMfaCode('')
      setMfaSecret(null)
    }
    onOpenChange(nextOpen)
  }

  const saveAvatar = async (nextAvatar: string | null) => {
    const previousAvatar = draftAvatar
    setDraftAvatar(nextAvatar)
    setIsSavingAvatar(true)

    try {
      const user = unwrapActionResult(await updateCurrentProfileAction({ avatarDataUrl: nextAvatar }))
      onAvatarSaved(user.avatarDataUrl)
      toast({ title: nextAvatar ? 'Avatar uploaded' : 'Avatar cleared' })
    } catch (error) {
      setDraftAvatar(previousAvatar)
      toast({
        title: 'Could not update avatar',
        description: getDisplayErrorMessage(error),
        variant: 'danger'
      })
    } finally {
      setIsSavingAvatar(false)
    }
  }

  const changePassword = async () => {
    if (newPassword !== confirmNewPassword) {
      toast({ title: 'Could not change password', description: 'New passwords do not match.', variant: 'danger' })
      return
    }

    setIsChangingPassword(true)
    try {
      unwrapActionResult(await changeCurrentPasswordAction({ currentPassword, newPassword }))
      toast({ title: 'Password changed', description: 'Log in again with your new password.' })
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

  const beginMfaSetup = async () => {
    setIsUpdatingMfa(true)
    try {
      const setup = unwrapActionResult(await beginMfaSetupAction(mfaPassword))
      setMfaSecret(setup.secret)
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
      setRecoveryCodes(result.recoveryCodes)
      toast({ title: 'Multi-factor authentication enabled' })
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
    <Dialog
      modal
      open={open}
      onOpenChange={handleOpenChange}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Profile</DialogTitle>
          <DialogDescription>Manage your web UI profile and password.</DialogDescription>
        </DialogHeader>
        <UserAvatarInput
          name={name}
          avatar={draftAvatar}
          disabled={isSavingAvatar}
          onChange={nextAvatar => void saveAvatar(nextAvatar)}
        />
        <AccentColorPicker
          className='border-t border-surface-border/60 pt-4'
          value={accentColor}
          onChange={setAccentColor}
        />
        <section className='grid gap-3 border-t border-surface-border/60 pt-4'>
          <div>
            <h3 className='text-sm font-medium'>Multi-factor authentication</h3>
            <p className='text-sm text-foreground-muted'>Use any TOTP authenticator. Recovery codes work once.</p>
          </div>
          {recoveryCodes.length > 0 ? (
            <div className='grid gap-2 rounded-panel border border-warning/30 bg-warning/10 p-3 text-sm'>
              <p>Save these recovery codes now; they will not be shown again.</p>
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
              <div className='grid gap-2'>
                <Label htmlFor='profile-mfa-password'>Current password</Label>
                <Input
                  id='profile-mfa-password'
                  type='password'
                  autoComplete='current-password'
                  value={mfaPassword}
                  onChange={event => setMfaPassword(event.target.value)}
                />
              </div>
              {mfaSecret ? (
                <div className='grid gap-2'>
                  <p className='text-sm'>
                    Add this key to your authenticator: <code className='break-all'>{mfaSecret}</code>
                  </p>
                  <Label htmlFor='profile-mfa-code'>Authentication code</Label>
                  <Input
                    id='profile-mfa-code'
                    inputMode='numeric'
                    autoComplete='one-time-code'
                    value={mfaCode}
                    onChange={event => setMfaCode(event.target.value)}
                  />
                  <Button
                    variant='secondary'
                    disabled={isUpdatingMfa || !mfaCode}
                    onClick={() => void confirmMfaSetup()}
                  >
                    Verify and enable
                  </Button>
                </div>
              ) : mfaEnabled ? (
                <>
                  <Label htmlFor='profile-mfa-code'>Authentication or recovery code</Label>
                  <Input
                    id='profile-mfa-code'
                    autoComplete='one-time-code'
                    value={mfaCode}
                    onChange={event => setMfaCode(event.target.value)}
                  />
                  <Button
                    variant='secondary'
                    disabled={isUpdatingMfa || !mfaPassword || !mfaCode}
                    onClick={() => void disableMfa()}
                  >
                    Disable MFA
                  </Button>
                </>
              ) : (
                <Button
                  variant='secondary'
                  disabled={isUpdatingMfa || !mfaPassword}
                  onClick={() => void beginMfaSetup()}
                >
                  Set up MFA
                </Button>
              )}
            </>
          )}
        </section>
        <section className='grid gap-3 border-t border-surface-border/60 pt-4'>
          <div>
            <h3 className='text-sm font-medium'>Change password</h3>
            <p className='text-sm text-foreground-muted'>Confirm your current password before setting a new one.</p>
          </div>
          <div className='grid gap-2'>
            <Label htmlFor='profile-current-password'>Current password</Label>
            <Input
              id='profile-current-password'
              type='password'
              autoComplete='current-password'
              value={currentPassword}
              onChange={event => setCurrentPassword(event.target.value)}
            />
          </div>
          <div className='grid gap-2 sm:grid-cols-2'>
            <div className='grid gap-2'>
              <Label htmlFor='profile-new-password'>New password</Label>
              <Input
                id='profile-new-password'
                type='password'
                autoComplete='new-password'
                value={newPassword}
                onChange={event => setNewPassword(event.target.value)}
              />
            </div>
            <div className='grid gap-2'>
              <Label htmlFor='profile-confirm-new-password'>Confirm new password</Label>
              <Input
                id='profile-confirm-new-password'
                type='password'
                autoComplete='new-password'
                value={confirmNewPassword}
                onChange={event => setConfirmNewPassword(event.target.value)}
              />
            </div>
          </div>
          <Button
            variant='secondary'
            disabled={isChangingPassword || !currentPassword || !newPassword || !confirmNewPassword}
            onClick={() => void changePassword()}
          >
            Change password
          </Button>
        </section>
      </DialogContent>
    </Dialog>
  )
}
