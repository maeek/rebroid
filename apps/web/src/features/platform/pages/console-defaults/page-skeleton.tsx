import { defaultWebSettingsResponse, pickGeneralUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'
import { ConsoleDefaultsPageClient } from './page-client'

export const ConsoleDefaultsPageSkeleton = () => (
  <ConsoleDefaultsPageClient
    initialSettings={pickGeneralUiSettings(defaultWebSettingsResponse)}
    loading
  />
)
