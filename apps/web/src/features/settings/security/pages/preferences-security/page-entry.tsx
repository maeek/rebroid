import { Suspense } from 'react'
import { PreferencesSecurityPageClient } from './page-client'
import { getPreferencesSecurityPageData } from './page-data.server'
import { PreferencesSecurityPageSkeleton } from './page-skeleton'

const PreferencesSecurityContent = async () => {
  const data = await getPreferencesSecurityPageData()
  return <PreferencesSecurityPageClient {...data} />
}

export default function PreferencesSecurityPageEntry() {
  return (
    <Suspense fallback={<PreferencesSecurityPageSkeleton />}>
      <PreferencesSecurityContent />
    </Suspense>
  )
}
