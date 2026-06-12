import type { AndroidApplication } from '@/server/orchestrator/applications/types'
import type { SortingState } from '@tanstack/react-table'

const defaultSorting: SortingState = [{ id: 'name', desc: false }]
const visibleFirewallCidrCount = 3

const firewallPolicyResult = (application: AndroidApplication) =>
  application.network.policy.result?.code ?? application.network.policy.status ?? ''

const compareFirewallApplications = (
  left: AndroidApplication,
  right: AndroidApplication,
  sorting: SortingState[number]
) => {
  if (sorting.id === 'name') return left.name.localeCompare(right.name)
  if (sorting.id === 'runtime') return left.status.currentStatus.localeCompare(right.status.currentStatus)
  if (sorting.id === 'result') return firewallPolicyResult(left).localeCompare(firewallPolicyResult(right))
  if (sorting.id === 'restricted') {
    return Number(left.network.policy.enabled) - Number(right.network.policy.enabled)
  }

  return 0
}

export const sortFirewallApplications = (applications: AndroidApplication[], sorting: SortingState) => {
  const activeSorting = sorting.length > 0 ? sorting : defaultSorting

  return [...applications].sort((left, right) => {
    for (const item of activeSorting) {
      const result = compareFirewallApplications(left, right, item)
      if (result !== 0) return result * (item.desc ? -1 : 1)
    }

    return left.id.localeCompare(right.id)
  })
}

export const filterFirewallApplications = (applications: AndroidApplication[], search: string) => {
  const query = search.trim().toLowerCase()
  if (!query) return applications

  return applications.filter(application =>
    [
      application.id,
      application.name,
      application.status.currentStatus,
      application.network.policy.status,
      ...application.network.policy.allowCidrs
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(query)
  )
}

export const paginateFirewallApplications = (applications: AndroidApplication[], pageIndex: number, pageSize: number) =>
  applications.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize)

export const clampFirewallPageIndex = (totalItems: number, pageSize: number, pageIndex: number) => {
  const pageCount = Math.max(Math.ceil(totalItems / pageSize), 1)

  return Math.min(pageIndex, pageCount - 1)
}

export const retainVisibleFirewallSelection = (applications: AndroidApplication[], selectedIds: Set<string>) => {
  const visibleIds = new Set(applications.map(application => application.id))

  return new Set([...selectedIds].filter(id => visibleIds.has(id)))
}

export const selectedFirewallApplicationsFromIds = (applications: AndroidApplication[], selectedIds: Set<string>) =>
  applications.filter(application => selectedIds.has(application.id))

export const replaceFirewallApplication = (applications: AndroidApplication[], updated: AndroidApplication) =>
  applications.map(application => (application.id === updated.id ? updated : application))

export const mergeFirewallApplications = (
  applications: AndroidApplication[],
  updatedApplications: AndroidApplication[]
) => {
  const updatedById = new Map(updatedApplications.map(application => [application.id, application]))

  return applications.map(application => updatedById.get(application.id) ?? application)
}

export const firewallAllowlistDisplay = (cidrs: string[]) => ({
  empty: cidrs.length === 0,
  visibleCidrs: cidrs.slice(0, visibleFirewallCidrCount),
  hiddenCidrs: cidrs.slice(visibleFirewallCidrCount)
})

export const firewallPolicyResultDisplay = (application: AndroidApplication) => {
  const policy = application.network.policy

  return {
    label: policy.result?.code ?? policy.status ?? 'Not applied',
    variant: policy.result?.status === 'error' ? 'destructive' : 'secondary'
  } as const
}

export const firewallRestrictionLabel = (application: AndroidApplication) =>
  application.network.policy.enabled ? 'Restricted' : 'Unrestricted'

export const firewallReconcileActionState = ({
  busy,
  applicationCount,
  selectedCount
}: {
  busy: string | null
  applicationCount: number
  selectedCount: number
}) => ({
  disabled: busy !== null || applicationCount === 0,
  label: selectedCount > 0 ? `Reconcile ${selectedCount} selected` : 'Prune stale rules',
  busy: busy === 'reconcile'
})
