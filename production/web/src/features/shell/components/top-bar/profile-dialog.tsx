'use client'

import { useState } from 'react'
import { IconDeviceFloppy } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { UserAvatarInput } from '@/features/settings/users/components/user-avatar-input'
import { toast } from '@/hooks/use-toast'
import { updateCurrentProfileAction } from '@/server/users/actions/update-current-profile-action'

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

  const saveProfile = async () => {
    setIsSaving(true)
    try {
      const user = await updateCurrentProfileAction({ avatarDataUrl: draftAvatar })
      onAvatarSaved(user.avatarDataUrl)
      onOpenChange(false)
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

  return (
    <Dialog
      modal
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Profile</DialogTitle>
          <DialogDescription>Choose the avatar shown in the web UI.</DialogDescription>
        </DialogHeader>
        <UserAvatarInput
          name={name}
          avatar={draftAvatar}
          onChange={setDraftAvatar}
        />
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
