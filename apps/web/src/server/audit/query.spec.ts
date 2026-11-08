import { describe, expect, it } from 'vitest'
import {
  auditFiltersFromSearchParams,
  auditFilterValuesFromFilters,
  auditSortFromSearchParams,
  auditEventsToCsv
} from './query'
import type { AuditEvent } from '@/shared/contracts/audit'

describe('audit URL and CSV normalization', () => {
  it.each(['2026-99-99', '2026-02-30', '2025-02-29', '2026-11-31', 'not-a-date'])(
    'ignores invalid calendar dates safely: %s',
    value => {
      expect(auditFiltersFromSearchParams({ from: value, to: value })).toMatchObject({ from: undefined, to: undefined })
    }
  )

  it('retains inclusive UTC date boundaries and precise timestamps', () => {
    expect(auditFiltersFromSearchParams({ from: '2024-02-29', to: '2024-02-29' })).toMatchObject({
      from: '2024-02-29T00:00:00.000Z',
      to: '2024-02-29T23:59:59.999Z'
    })
    expect(auditFiltersFromSearchParams({ from: '2026-11-08T12:30:00+02:00' }).from).toBe('2026-11-08T10:30:00.000Z')
  })

  it('returns the same validated filters for UI navigation, results, and export', () => {
    const parsed = auditFiltersFromSearchParams({
      search: ' start ',
      actor: ['admin', 'another'],
      outcome: 'unknown',
      from: 'bad',
      resourceId: ' app-1 '
    })
    const controls = auditFilterValuesFromFilters(parsed)
    expect(controls).toMatchObject({
      search: 'start',
      actor: 'admin',
      resourceId: 'app-1',
      outcome: undefined,
      from: undefined
    })
    expect(auditFiltersFromSearchParams(controls)).toEqual(parsed)
  })

  it('allows only known sorting fields and directions', () => {
    expect(auditSortFromSearchParams({ sort: 'outcome:asc,action:sideways,constructor:desc,createdAt:desc' })).toEqual([
      { id: 'outcome', desc: false },
      { id: 'createdAt', desc: true }
    ])
    expect(auditSortFromSearchParams({ sort: 'action:sideways' })).toEqual([{ id: 'createdAt', desc: true }])
  })

  it.each(['=formula()', '+formula()', '-formula()', '@formula()', '\tformula()', '\rformula()'])(
    'escapes spreadsheet formula prefixes: %s',
    actorLabel => {
      const event: AuditEvent = {
        id: 1,
        createdAt: '2026-11-08T00:00:00Z',
        actorLabel,
        actorUserId: null,
        category: 'auth',
        action: 'auth.login.success',
        outcome: 'success',
        resourceId: null,
        resourceType: null,
        resourceLabel: null,
        sourceIp: null,
        userAgent: null,
        details: { message: 'quote " and\nnewline' }
      }
      const csv = auditEventsToCsv([event])
      expect(csv).toContain(`"'${actorLabel.replaceAll('"', '""')}"`)
      expect(csv).toContain('auth.login.success')
      expect(csv).not.toContain('"null"')
    }
  )
})
