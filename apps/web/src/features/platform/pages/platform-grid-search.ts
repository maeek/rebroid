export type PlatformGridSearchParams = Record<string, string | string[] | undefined>

type PlatformGridSearchQuery = {
  page: number
  pageSize: number
  q?: string
  ownership: 'all' | 'managed'
  state?: string
  application?: string
  image?: string
  network?: string
  usage?: 'all' | 'in-use' | 'unused' | 'unknown'
  runtimeKind?: 'all' | 'redroid' | 'generic'
  androidVersion?: string
  architecture?: string
  gmsMode?: 'all' | 'none' | 'microg' | 'gapps'
  driver?: string
  dockerScope?: string
  trait?: 'all' | 'internal' | 'attachable' | 'ingress'
  attachment?: 'all' | 'attached' | 'unattached'
  sort?: string
}

const firstValue = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

export const platformGridQueryFromSearchParams = (searchParams: PlatformGridSearchParams): PlatformGridSearchQuery => {
  const ownership = firstValue(searchParams.ownership)
  const usage = firstValue(searchParams.usage)
  const runtimeKind = firstValue(searchParams.runtimeKind)
  const gmsMode = firstValue(searchParams.gmsMode)
  const trait = firstValue(searchParams.trait)
  const attachment = firstValue(searchParams.attachment)
  return {
    page: Math.max(Number(firstValue(searchParams.page)) || 1, 1),
    pageSize: Math.min(Math.max(Number(firstValue(searchParams.pageSize)) || 20, 1), 100),
    q: firstValue(searchParams.q)?.trim() || undefined,
    ownership: ownership === 'all' ? 'all' : 'managed',
    state: firstValue(searchParams.state)?.trim() || undefined,
    application: firstValue(searchParams.application)?.trim() || undefined,
    image: firstValue(searchParams.image)?.trim() || undefined,
    network: firstValue(searchParams.network)?.trim() || undefined,
    usage: usage === 'in-use' || usage === 'unused' || usage === 'unknown' ? usage : 'all',
    runtimeKind: runtimeKind === 'redroid' || runtimeKind === 'generic' ? runtimeKind : 'all',
    androidVersion: firstValue(searchParams.androidVersion)?.trim() || undefined,
    architecture: firstValue(searchParams.architecture)?.trim() || undefined,
    gmsMode: gmsMode === 'none' || gmsMode === 'microg' || gmsMode === 'gapps' ? gmsMode : 'all',
    driver: firstValue(searchParams.driver)?.trim() || undefined,
    dockerScope: firstValue(searchParams.dockerScope)?.trim() || undefined,
    trait: trait === 'internal' || trait === 'attachable' || trait === 'ingress' ? trait : 'all',
    attachment: attachment === 'attached' || attachment === 'unattached' ? attachment : 'all',
    sort: firstValue(searchParams.sort)?.trim() || undefined
  }
}
