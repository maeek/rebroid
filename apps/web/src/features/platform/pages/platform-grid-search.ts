import { firstSearchParamValue, positiveIntegerSearchParam } from '@/shared/model/search-params'
import type {
  PlatformContainersGridQuery,
  PlatformImagesGridQuery,
  PlatformNetworksGridQuery
} from '@/shared/contracts/platform'

export type PlatformGridSearchParams = Record<string, string | string[] | undefined>

export const platformGridQueryFromSearchParams = (searchParams: PlatformGridSearchParams) => {
  const ownership = firstSearchParamValue(searchParams.ownership)
  const usage = firstSearchParamValue(searchParams.usage)
  const runtimeKind = firstSearchParamValue(searchParams.runtimeKind)
  const gmsMode = firstSearchParamValue(searchParams.gmsMode)
  const trait = firstSearchParamValue(searchParams.trait)
  const attachment = firstSearchParamValue(searchParams.attachment)
  return {
    page: positiveIntegerSearchParam(searchParams.page, { fallback: 1 }),
    pageSize: positiveIntegerSearchParam(searchParams.pageSize, { fallback: 20, max: 100 }),
    q: firstSearchParamValue(searchParams.q)?.trim() || undefined,
    ownership: ownership === 'all' ? 'all' : 'managed',
    state: firstSearchParamValue(searchParams.state)?.trim() || undefined,
    application: firstSearchParamValue(searchParams.application)?.trim() || undefined,
    image: firstSearchParamValue(searchParams.image)?.trim() || undefined,
    network: firstSearchParamValue(searchParams.network)?.trim() || undefined,
    usage: usage === 'in-use' || usage === 'unused' || usage === 'unknown' ? usage : 'all',
    runtimeKind: runtimeKind === 'redroid' || runtimeKind === 'generic' ? runtimeKind : 'all',
    androidVersion: firstSearchParamValue(searchParams.androidVersion)?.trim() || undefined,
    architecture: firstSearchParamValue(searchParams.architecture)?.trim() || undefined,
    gmsMode: gmsMode === 'none' || gmsMode === 'microg' || gmsMode === 'gapps' ? gmsMode : 'all',
    driver: firstSearchParamValue(searchParams.driver)?.trim() || undefined,
    dockerScope: firstSearchParamValue(searchParams.dockerScope)?.trim() || undefined,
    trait: trait === 'internal' || trait === 'attachable' || trait === 'ingress' ? trait : 'all',
    attachment: attachment === 'attached' || attachment === 'unattached' ? attachment : 'all',
    sort: firstSearchParamValue(searchParams.sort)?.trim() || undefined
  } satisfies PlatformContainersGridQuery & PlatformImagesGridQuery & PlatformNetworksGridQuery
}
