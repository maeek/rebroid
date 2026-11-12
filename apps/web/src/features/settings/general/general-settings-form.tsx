'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { updateCurrentAccentColorAction } from '@/server/users/actions/update-current-accent-color-action'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { useAccentColorPreference } from '@/shared/model/theme/use-accent-color'
import { AppearanceSettings } from './general-settings-fields'
import { GeneralSettingsLayout } from './general-settings-layout'
import { ProfilePhotoSettings } from './profile-photo-settings'
import type { AccentColor } from '@/shared/model/theme/accent-color'

type PersonalSettings = {
  name: string
  avatarDataUrl: string | null
  accentColor: AccentColor
}

export const GeneralSettingsForm = ({ user }: { user: PersonalSettings }) => {
  const router = useRouter()
  const saveAccentColor = useCallback(async (nextAccentColor: AccentColor) => {
    unwrapActionResult(await updateCurrentAccentColorAction(nextAccentColor))
  }, [])
  const { accentColor, setAccentColor } = useAccentColorPreference({
    initialAccentColor: user.accentColor,
    saveAccentColor,
    onSaveError: error =>
      toast({
        title: 'Could not save accent color',
        description: getDisplayErrorMessage(error),
        variant: 'danger'
      })
  })

  return (
    <GeneralSettingsContent
      user={user}
      accentColor={accentColor}
      onAccentColorChange={setAccentColor}
      onAvatarSaved={() => router.refresh()}
    />
  )
}

export const GeneralSettingsContent = ({
  user,
  accentColor,
  onAccentColorChange,
  onAvatarSaved,
  loading = false
}: {
  user: Omit<PersonalSettings, 'accentColor'>
  accentColor: AccentColor
  onAccentColorChange: (accentColor: AccentColor) => void
  onAvatarSaved: () => void
  loading?: boolean
}) => (
  <GeneralSettingsLayout>
    <AppearanceSettings
      accentColor={accentColor}
      onAccentColorChange={onAccentColorChange}
      loading={loading}
    />
    <div
      id='profile'
      className='scroll-mt-[calc(var(--console-top-inset)+1rem)]'
    >
      <ProfilePhotoSettings
        name={user.name}
        avatar={user.avatarDataUrl}
        onSaved={onAvatarSaved}
        loading={loading}
      />
    </div>
  </GeneralSettingsLayout>
)
