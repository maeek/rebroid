'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { MutationButton } from '@/components/ui/mutation-button'
import { Section } from '@/components/ui/section'
import { useSaveFeedback } from '@/hooks/use-save-feedback'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { updateCurrentProfileAction } from '@/server/users/actions/update-current-profile-action'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { UserAvatarInput } from '@/shared/ui/user-avatar/user-avatar-input'

export const ProfilePhotoSettings = ({
  name,
  avatar,
  onSaved,
  loading = false
}: {
  name: string
  avatar: string | null
  onSaved: () => void
  loading?: boolean
}) => {
  const [savedAvatar, setSavedAvatar] = useState(avatar)
  const [draftAvatar, setDraftAvatar] = useState(avatar)
  const [preparing, setPreparing] = useState(false)
  const [saving, setSaving] = useState(false)
  const saveFeedback = useSaveFeedback(draftAvatar)
  const dirty = draftAvatar !== savedAvatar
  const busy = loading || preparing || saving

  const savePhoto = async () => {
    if (!dirty || busy) return
    saveFeedback.resetSaveFeedback()
    setSaving(true)
    try {
      const user = unwrapActionResult(await updateCurrentProfileAction({ avatarDataUrl: draftAvatar }))
      setSavedAvatar(user.avatarDataUrl)
      setDraftAvatar(user.avatarDataUrl)
      saveFeedback.confirmSaved(user.avatarDataUrl)
      onSaved()
      toast({ title: 'Profile photo saved', variant: 'success' })
    } catch (error) {
      toast({ title: 'Could not save profile photo', description: getDisplayErrorMessage(error), variant: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Section
      surface='plain'
      title='Profile'
    >
      <UserAvatarInput
        name={name}
        avatar={draftAvatar}
        disabled={busy}
        onChange={setDraftAvatar}
        onPendingChange={setPreparing}
      />
      <div className='flex flex-wrap gap-2'>
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
          disabled={!dirty || loading || preparing}
          pending={saving}
          animate
          pendingLabel='Saving…'
          success={saveFeedback.saved}
          onClick={() => void savePhoto()}
        >
          Save photo
        </MutationButton>
      </div>
    </Section>
  )
}
