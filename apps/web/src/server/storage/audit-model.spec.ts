import { describe, expect, it } from '@jest/globals'
import {
  auditOrderBy,
  auditRetentionCutoff,
  auditWhere,
  normalizeAuditDetails,
  normalizeAuditPagination,
  parseAuditRow
} from './audit-model'

describe('audit model', () => {
  it('serializes details with bigint values', () => {
    expect(JSON.parse(normalizeAuditDetails({ count: BigInt(12) }))).toEqual({ count: '12' })
  })

  it('parses database rows into audit events', () => {
    expect(
      parseAuditRow({
        id: 1,
        actor_user_id: 'user-1',
        actor_label: 'User One',
        action: 'application.start',
        category: 'application',
        resource_type: 'application',
        resource_id: 'app-1',
        resource_label: 'App',
        outcome: 'success',
        details_json: '{"ok":true}',
        source_ip: null,
        user_agent: null,
        created_at: '2026-01-01T00:00:00.000Z'
      })
    ).toMatchObject({
      actorUserId: 'user-1',
      details: { ok: true },
      resourceId: 'app-1'
    })
  })

  it('builds allowlisted audit filter SQL', () => {
    const where = auditWhere({
      search: ' Start ',
      actorUserId: 'user-1',
      category: 'application',
      outcome: 'success'
    })

    expect(where.sql).toContain('WHERE')
    expect(where.sql).toContain('actor_user_id = ?')
    expect(where.values).toEqual([
      '%start%',
      '%start%',
      '%start%',
      '%start%',
      '%start%',
      '%start%',
      '%start%',
      'user-1',
      'application',
      'success'
    ])
  })

  it('builds allowlisted order clauses and pagination', () => {
    expect(auditOrderBy([{ id: 'actorLabel', desc: false }])).toBe('actor_label ASC, id DESC')
    expect(auditOrderBy()).toBe('created_at DESC, id DESC')
    expect(normalizeAuditPagination(-4, 500)).toEqual({ page: 1, pageSize: 100 })
  })

  it('returns null for disabled retention and cutoff for valid retention', () => {
    expect(auditRetentionCutoff(0, Date.UTC(2026, 0, 31))).toBeNull()
    expect(auditRetentionCutoff(30, Date.UTC(2026, 0, 31))).toBe('2026-01-01T00:00:00.000Z')
  })
})
