import { Suspense } from 'react'
import { GeneralSettingsForm } from '../../general-settings-form'
import { getPreferencesGeneralPageData } from './page-data.server'
import { PreferencesGeneralPageSkeleton } from './preferences-general-page-skeleton'

const PreferencesGeneralContent = async () => {
  const { user, initialSettings } = await getPreferencesGeneralPageData()

  return (
    <GeneralSettingsForm
      user={user}
      initialSettings={initialSettings}
    />
  )
}

export default function PreferencesGeneralPageEntry() {
  return (
    <Suspense fallback={<PreferencesGeneralPageSkeleton />}>
      <PreferencesGeneralContent />
    </Suspense>
  )
}
