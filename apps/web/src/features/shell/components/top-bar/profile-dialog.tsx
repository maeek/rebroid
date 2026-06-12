'use client'

import { useState } from 'react'
import { IconDeviceFloppy } from '@tabler/icons-react'
import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import { changeCurrentPasswordAction } from '@/server/users/actions/change-current-password-action'
import { updateCurrentProfileAction } from '@/server/users/actions/update-current-profile-action'
import { UserAvatarInput } from '@/shared/ui/user-avatar/user-avatar-input'

export const ProfileDialog = ({
  open,
  name,
  avatar,
  onOpenChange,
  onAvatarSaved
}: {
  open: boolean
  name: string
  avatar: string | null
  onOpenChange: (open: boolean) => void
  onAvatarSaved: (avatar: string | null) => void
}) => {
  const [draftAvatar, setDraftAvatar] = useState(avatar)
  const [isSaving, setIsSaving] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmNewPassword('')
    }
    onOpenChange(nextOpen)
  }

  const saveProfile = async () => {
    setIsSaving(true)
    try {
      const user = await updateCurrentProfileAction({ avatarDataUrl: draftAvatar })
      onAvatarSaved(user.avatarDataUrl)
      handleOpenChange(false)
      toast({ title: 'Profile saved' })
    } catch (error) {
      toast({
        title: 'Could not save profile',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setIsSaving(false)
    }
  }

  const changePassword = async () => {
    if (newPassword !== confirmNewPassword) {
      toast({ title: 'Could not change password', description: 'New passwords do not match.', variant: 'destructive' })
      return
    }

    setIsChangingPassword(true)
    try {
      await changeCurrentPasswordAction({ currentPassword, newPassword })
      toast({ title: 'Password changed', description: 'Log in again with your new password.' })
      await signOut({ callbackUrl: '/login', redirect: true })
    } catch (error) {
      toast({
        title: 'Could not change password',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setIsChangingPassword(false)
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
          onChange={setDraftAvatar}
        />
        <section className='grid gap-3 border-t border-border/60 pt-4'>
          <div>
            <h3 className='text-sm font-medium'>Change password</h3>
            <p className='text-sm text-muted-foreground'>Confirm your current password before setting a new one.</p>
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
        <DialogFooter>
          <Button
            disabled={isSaving}
            onClick={() => void saveProfile()}
          >
            <IconDeviceFloppy className='size-4' />
            Save profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
