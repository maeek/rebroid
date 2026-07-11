import { PlatformServicesPage } from '@/features/platform/services/services-page'
import { loadPlatformServicesPageData } from './page-data.server'
import type { ServicesSearchParams } from './page-data.server'

export const PlatformServicesPageEntry = async ({ searchParams }: { searchParams?: Promise<ServicesSearchParams> }) => (
  <PlatformServicesPage {...await loadPlatformServicesPageData(searchParams)} />
)
