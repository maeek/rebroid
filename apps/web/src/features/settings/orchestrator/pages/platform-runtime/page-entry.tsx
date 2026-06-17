import { Suspense } from 'react'
import { SettingsPageSkeleton } from '@/shared/ui/settings/settings-page-skeleton'
import { PlatformRuntimeForm } from '../../platform-runtime-form'
import { getPlatformRuntimePageData } from './page-data.server'

const PlatformRuntimeContent = async () => {
  const { initialSettings } = await getPlatformRuntimePageData()

  return <PlatformRuntimeForm initialSettings={initialSettings} />
}

export default function PlatformRuntimePageEntry() {
  return (
    <Suspense
      fallback={
        <SettingsPageSkeleton
          title='Runtime defaults'
          sectionTitle='Runtime'
          rows={4}
          variant='orchestrator'
        />
      }
    >
      <PlatformRuntimeContent />
    </Suspense>
  )
}
