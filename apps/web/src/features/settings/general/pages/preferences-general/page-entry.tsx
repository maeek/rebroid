import { Suspense } from 'react'
import { GeneralSettingsForm } from '../../general-settings-form'
import { getPreferencesGeneralPageData } from './page-data.server'
import { PreferencesGeneralPageSkeleton } from './preferences-general-page-skeleton'

const PreferencesGeneralContent = async () => {
  const { user } = await getPreferencesGeneralPageData()

  return <GeneralSettingsForm user={user} />
}

export default function PreferencesGeneralPageEntry() {
  return (
    <Suspense fallback={<PreferencesGeneralPageSkeleton />}>
      <PreferencesGeneralContent />
    </Suspense>
  )
}
