'use client'

import { defaultOrchestratorUiSettings, pickGeneralUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'
import { GeneralSettingsContent } from '../../general-settings-form'

export const PreferencesGeneralPageSkeleton = ({ showDefaults = false }: { showDefaults?: boolean }) => (
  <GeneralSettingsContent
    user={{ name: '', avatarDataUrl: null, mfaEnabled: false }}
    accentColor='blue'
    onAccentColorChange={() => {}}
    onAvatarSaved={() => {}}
    initialSettings={showDefaults ? pickGeneralUiSettings(defaultOrchestratorUiSettings) : undefined}
    loading
  />
)
