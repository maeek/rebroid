'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Section } from '@/components/ui/section'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { updateCurrentAccentColorAction } from '@/server/users/actions/update-current-accent-color-action'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { useAccentColorPreference } from '@/shared/model/theme/use-accent-color'
import { AccountMfaSettings } from './account-mfa-settings'
import { AccountPasswordSettings } from './account-password-settings'
import { ConsoleDefaultsForm } from './console-defaults-form'
import { AppearanceSettings } from './general-settings-fields'
import { GeneralSettingsLayout } from './general-settings-layout'
import { ProfilePhotoSettings } from './profile-photo-settings'
import type { GeneralUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'
import type { AccentColor } from '@/shared/model/theme/accent-color'

type PersonalSettings = {
  name: string
  avatarDataUrl: string | null
  mfaEnabled: boolean
  accentColor: AccentColor
}

export const GeneralSettingsForm = ({
  user,
  initialSettings
}: {
  user: PersonalSettings
  initialSettings?: GeneralUiSettings
}) => {
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
      initialSettings={initialSettings}
    />
  )
}

export const GeneralSettingsContent = ({
  user,
  accentColor,
  onAccentColorChange,
  onAvatarSaved,
  initialSettings,
  loading = false
}: {
  user: Omit<PersonalSettings, 'accentColor'>
  accentColor: AccentColor
  onAccentColorChange: (accentColor: AccentColor) => void
  onAvatarSaved: () => void
  initialSettings?: GeneralUiSettings
  loading?: boolean
}) => (
  <GeneralSettingsLayout showDefaults={initialSettings !== undefined}>
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
    <div
      id='security'
      className='scroll-mt-[calc(var(--console-top-inset)+1rem)]'
    >
      <Section
        surface='plain'
        title='Security'
      >
        <div className='grid min-w-0 gap-x-form-column gap-y-6 lg:grid-cols-2'>
          <AccountMfaSettings
            initialEnabled={user.mfaEnabled}
            loading={loading}
          />
          <AccountPasswordSettings loading={loading} />
        </div>
      </Section>
    </div>
    {initialSettings ? (
      <ConsoleDefaultsForm
        initialSettings={initialSettings}
        loading={loading}
      />
    ) : null}
  </GeneralSettingsLayout>
)
