import { Suspense } from 'react'
import { SettingsPageSkeleton } from '@/shared/ui/settings/settings-page-skeleton'
import { GeneralSettingsForm } from '../../general-settings-form'
import { getPreferencesGeneralPageData } from './page-data.server'

const PreferencesGeneralContent = async () => {
  const { initialSettings } = await getPreferencesGeneralPageData()

  return <GeneralSettingsForm initialSettings={initialSettings} />
}

export default function PreferencesGeneralPageEntry() {
  return (
    <Suspense
      fallback={
        <SettingsPageSkeleton
          title='General'
          sectionTitle='Misc'
          rows={2}
        />
      }
    >
      <PreferencesGeneralContent />
    </Suspense>
  )
}
