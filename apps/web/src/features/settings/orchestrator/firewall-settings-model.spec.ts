import { describe, expect, it } from 'vitest'
import {
  clampFirewallPageIndex,
  firewallAllowlistDisplay,
  firewallPolicyResultDisplay,
  firewallReconcileActionState,
  firewallRestrictionLabel,
  filterFirewallApplications,
  mergeFirewallApplications,
  paginateFirewallApplications,
  replaceFirewallApplication,
  retainVisibleFirewallSelection,
  selectedFirewallApplicationsFromIds,
  sortFirewallApplications
} from './firewall-settings-model'
import type { AndroidApplication } from '@/server/orchestrator/applications/types'

const app = (
  id: string,
  overrides: {
    name?: string
    status?: string
    policyStatus?: string
    resultCode?: string
    restricted?: boolean
    allowCidrs?: string[]
  } = {}
): AndroidApplication =>
  ({
    id,
    name: overrides.name ?? id,
    status: {
      currentStatus: overrides.status ?? 'running'
    },
    network: {
      policy: {
        enabled: overrides.restricted ?? false,
        status: overrides.policyStatus,
        result: overrides.resultCode ? { code: overrides.resultCode } : null,
        allowCidrs: overrides.allowCidrs ?? []
      }
    }
  }) as unknown as AndroidApplication

describe('firewall settings model', () => {
  it('filters applications by identity, status, policy status, and CIDR', () => {
    const applications = [
      app('alpha', { name: 'Calendar', allowCidrs: ['10.0.0.0/24'] }),
      app('beta', { status: 'stopped', policyStatus: 'pending' })
    ]

    expect(filterFirewallApplications(applications, 'calendar')).toEqual([applications[0]])
    expect(filterFirewallApplications(applications, '10.0.0.0')).toEqual([applications[0]])
    expect(filterFirewallApplications(applications, 'pending')).toEqual([applications[1]])
    expect(filterFirewallApplications(applications, 'stopped')).toEqual([applications[1]])
  })

  it('sorts by known firewall columns and falls back to application id', () => {
    const applications = [
      app('b', { name: 'Same', restricted: true, resultCode: 'zeta' }),
      app('a', { name: 'Same', restricted: false, resultCode: 'alpha' }),
      app('c', { name: 'Same', restricted: true, resultCode: 'beta' })
    ]

    expect(sortFirewallApplications(applications, [{ id: 'result', desc: false }]).map(item => item.id)).toEqual([
      'a',
      'c',
      'b'
    ])
    expect(sortFirewallApplications(applications, [{ id: 'restricted', desc: true }]).map(item => item.id)).toEqual([
      'b',
      'c',
      'a'
    ])
    expect(sortFirewallApplications(applications, [{ id: 'name', desc: false }]).map(item => item.id)).toEqual([
      'a',
      'b',
      'c'
    ])
  })

  it('uses name sorting by default', () => {
    const applications = [app('a', { name: 'Zulu' }), app('b', { name: 'Alpha' })]

    expect(sortFirewallApplications(applications, []).map(item => item.id)).toEqual(['b', 'a'])
  })

  it('paginates and clamps page indexes', () => {
    const applications = [app('a'), app('b'), app('c')]

    expect(paginateFirewallApplications(applications, 1, 2)).toEqual([applications[2]])
    expect(clampFirewallPageIndex(3, 2, 4)).toBe(1)
    expect(clampFirewallPageIndex(0, 20, 4)).toBe(0)
  })

  it('retains and derives visible selection', () => {
    const applications = [app('a'), app('c')]
    const selectedIds = new Set(['a', 'b', 'c'])

    expect([...retainVisibleFirewallSelection(applications, selectedIds)]).toEqual(['a', 'c'])
    expect(selectedFirewallApplicationsFromIds(applications, selectedIds)).toEqual(applications)
  })

  it('replaces and merges updated applications', () => {
    const applications = [app('a'), app('b'), app('c')]
    const updatedB = app('b', { name: 'Updated B' })
    const updatedC = app('c', { restricted: true })

    expect(replaceFirewallApplication(applications, updatedB)).toEqual([applications[0], updatedB, applications[2]])
    expect(mergeFirewallApplications(applications, [updatedB, updatedC])).toEqual([applications[0], updatedB, updatedC])
  })

  it('derives allowlist and policy display state', () => {
    expect(firewallAllowlistDisplay([])).toEqual({
      empty: true,
      visibleCidrs: [],
      hiddenCidrs: []
    })
    expect(firewallAllowlistDisplay(['10.0.0.0/24', '10.0.1.0/24', '10.0.2.0/24', '10.0.3.0/24'])).toEqual({
      empty: false,
      visibleCidrs: ['10.0.0.0/24', '10.0.1.0/24', '10.0.2.0/24'],
      hiddenCidrs: ['10.0.3.0/24']
    })
    expect(firewallPolicyResultDisplay(app('a', { resultCode: 'apply_failed' }))).toEqual({
      label: 'apply_failed',
      variant: 'neutral'
    })
    expect(
      firewallPolicyResultDisplay(
        app('b', {
          policyStatus: 'pending',
          resultCode: undefined
        })
      )
    ).toEqual({
      label: 'pending',
      variant: 'neutral'
    })
    expect(firewallRestrictionLabel(app('restricted', { restricted: true }))).toBe('Restricted')
    expect(firewallRestrictionLabel(app('open', { restricted: false }))).toBe('Unrestricted')
  })

  it('derives reconcile action state', () => {
    expect(firewallReconcileActionState({ busy: null, applicationCount: 0, selectedCount: 0 })).toEqual({
      disabled: true,
      label: 'Prune stale rules',
      busy: false
    })
    expect(firewallReconcileActionState({ busy: 'reconcile', applicationCount: 2, selectedCount: 1 })).toEqual({
      disabled: true,
      label: 'Reconcile 1 selected',
      busy: true
    })
    expect(firewallReconcileActionState({ busy: null, applicationCount: 2, selectedCount: 0 })).toEqual({
      disabled: false,
      label: 'Prune stale rules',
      busy: false
    })
  })
})
