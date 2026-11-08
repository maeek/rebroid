'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { MutationButton } from '@/components/ui/mutation-button'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { updateCurrentProfileAction } from '@/server/users/actions/update-current-profile-action'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { UserAvatarInput } from '@/shared/ui/user-avatar/user-avatar-input'

export const ProfilePhotoSettings = ({
  name,
  avatar,
  onSaved
}: {
  name: string
  avatar: string | null
  onSaved: (avatar: string | null) => void
}) => {
  const [savedAvatar, setSavedAvatar] = useState(avatar)
  const [draftAvatar, setDraftAvatar] = useState(avatar)
  const [preparing, setPreparing] = useState(false)
  const [saving, setSaving] = useState(false)
  const dirty = draftAvatar !== savedAvatar
  const busy = preparing || saving

  const savePhoto = async () => {
    if (!dirty || busy) return
    setSaving(true)
    try {
      const user = unwrapActionResult(await updateCurrentProfileAction({ avatarDataUrl: draftAvatar }))
      setSavedAvatar(user.avatarDataUrl)
      setDraftAvatar(user.avatarDataUrl)
      onSaved(user.avatarDataUrl)
      toast({ title: 'Profile photo saved', variant: 'success' })
    } catch (error) {
      toast({ title: 'Could not save profile photo', description: getDisplayErrorMessage(error), variant: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className='grid gap-4'>
      <UserAvatarInput
        name={name}
        avatar={draftAvatar}
        disabled={busy}
        onChange={setDraftAvatar}
        onPendingChange={setPreparing}
      />
      <div className='flex justify-end gap-2'>
        <Button
          type='button'
          variant='ghost'
          disabled={!dirty || busy}
          onClick={() => setDraftAvatar(savedAvatar)}
        >
          Discard changes
        </Button>
        <MutationButton
          type='button'
          disabled={!dirty || preparing}
          pending={saving}
          pendingLabel='Saving…'
          onClick={() => void savePhoto()}
        >
          Save photo
        </MutationButton>
      </div>
    </section>
  )
}
