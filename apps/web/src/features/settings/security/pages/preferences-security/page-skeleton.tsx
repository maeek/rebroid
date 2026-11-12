import { PreferencesSecurityPageClient } from './page-client'

export const PreferencesSecurityPageSkeleton = () => (
  <PreferencesSecurityPageClient
    mfaEnabled={false}
    loading
  />
)
