import { describe, expect, it } from 'vitest'
import {
  clampFirewallPageIndex,
  firewallAllowlistDisplay,
  firewallPolicyEnforcement,
  firewallReconcileActionState,
  firewallAccessLabel,
  filterFirewallApplications,
  mergeFirewallApplications,
  paginateFirewallApplications,
  retainVisibleFirewallSelection,
  selectedFirewallApplicationsFromIds,
  sortFirewallApplications
} from './firewall-settings-model'
import type { AndroidApplication } from '@/shared/contracts/application'

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
        result: overrides.resultCode ? { code: overrides.resultCode, status: overrides.policyStatus } : null,
        allowCidrs: overrides.allowCidrs ?? []
      }
    }
  }) as unknown as AndroidApplication

describe('firewall settings model', () => {
  it('filters applications by identity, status, policy status, and CIDR', () => {
    const applications = [
      app('alpha', { name: 'Calendar', allowCidrs: ['10.0.0.0/24'] }),
      app('beta', { status: 'stopped', policyStatus: 'error', resultCode: 'apply_failed' })
    ]

    expect(filterFirewallApplications(applications, 'calendar')).toEqual([applications[0]])
    expect(filterFirewallApplications(applications, '10.0.0.0')).toEqual([applications[0]])
    expect(filterFirewallApplications(applications, 'needs attention')).toEqual([applications[1]])
    expect(filterFirewallApplications(applications, 'stopped')).toEqual([applications[1]])
  })

  it('sorts by known firewall columns and falls back to application id', () => {
    const applications = [
      app('b', { name: 'Same', restricted: true }),
      app('a', { name: 'Same', restricted: false, resultCode: 'policy_disabled', policyStatus: 'skipped' }),
      app('c', { name: 'Same', restricted: true, resultCode: 'applied', policyStatus: 'applied' })
    ]

    expect(sortFirewallApplications(applications, [{ id: 'enforcement', desc: false }]).map(item => item.id)).toEqual([
      'c',
      'a',
      'b'
    ])
    expect(sortFirewallApplications(applications, [{ id: 'access', desc: false }]).map(item => item.id)).toEqual([
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

  it('merges updated applications', () => {
    const applications = [app('a'), app('b'), app('c')]
    const updatedB = app('b', { name: 'Updated B' })
    const updatedC = app('c', { restricted: true })

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
    expect(firewallPolicyEnforcement(app('a', { policyStatus: 'error', resultCode: 'apply_failed' }))).toMatchObject({
      label: 'Needs attention',
      tone: 'danger'
    })
    expect(firewallPolicyEnforcement(app('b', { restricted: true }))).toMatchObject({
      label: 'Unverified',
      tone: 'warning'
    })
    expect(
      firewallPolicyEnforcement(
        app('c', { status: 'stopped', restricted: true, resultCode: 'applied', policyStatus: 'applied' })
      )
    ).toMatchObject({ label: 'On next start', tone: 'neutral' })
    expect(firewallAccessLabel(app('restricted', { restricted: true }))).toBe('Approved destinations only')
    expect(firewallAccessLabel(app('open', { restricted: false }))).toBe('Unrestricted')
  })

  it('derives reconcile action state', () => {
    expect(firewallReconcileActionState({ busy: null, applicationCount: 0, selectedCount: 0 })).toEqual({
      disabled: true,
      label: 'Sync all rules',
      busy: false
    })
    expect(firewallReconcileActionState({ busy: 'reconcile', applicationCount: 2, selectedCount: 1 })).toEqual({
      disabled: true,
      label: 'Sync 1 selected',
      busy: true
    })
    expect(firewallReconcileActionState({ busy: null, applicationCount: 2, selectedCount: 0 })).toEqual({
      disabled: false,
      label: 'Sync all rules',
      busy: false
    })
  })
})
