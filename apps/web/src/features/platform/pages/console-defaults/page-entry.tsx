import { Suspense } from 'react'
import { ConsoleDefaultsPageClient } from './page-client'
import { getConsoleDefaultsPageData } from './page-data.server'
import { ConsoleDefaultsPageSkeleton } from './page-skeleton'

const ConsoleDefaultsContent = async () => {
  const { initialSettings } = await getConsoleDefaultsPageData()
  return <ConsoleDefaultsPageClient initialSettings={initialSettings} />
}

export default function ConsoleDefaultsPageEntry() {
  return (
    <Suspense fallback={<ConsoleDefaultsPageSkeleton />}>
      <ConsoleDefaultsContent />
    </Suspense>
  )
}
