'use client'

import { GeneralSettingsContent } from '../../general-settings-form'

export const PreferencesGeneralPageSkeleton = () => (
  <GeneralSettingsContent
    user={{ name: '', avatarDataUrl: null }}
    accentColor='blue'
    onAccentColorChange={() => {}}
    onAvatarSaved={() => {}}
    loading
  />
)
