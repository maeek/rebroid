'use client'

import { defaultOrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'
import { GeneralSettingsFields } from '../../general-settings-fields'
import { GeneralSettingsLayout } from '../../general-settings-layout'

export const PreferencesGeneralPageSkeleton = () => (
  <GeneralSettingsLayout loading>
    <GeneralSettingsFields
      settings={defaultOrchestratorUiSettings}
      accentColor='blue'
      onSettingsChange={() => {}}
      onAccentColorChange={() => {}}
      loading
    />
  </GeneralSettingsLayout>
)
