import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { auditEventsToCsv, auditSortFromSearchParams } from '@/server/audit/query'
import { completeTestAdministratorSetup } from '@/server/auth/test-administrator'
import { userService } from '@/server/auth/user'
import { getWebSettings, saveWebSettings } from '@/server/web-settings/store'
import { serializeSortParam } from '@/shared/model/search-params'
import {
  appendAuditEvent,
  exportAuditEvents,
  listAuditEvents,
  listAuditFacetValues,
  pruneAuditEventsOlderThan,
  purgeAuditEvents
} from './audit-repository'
import { consumePersistentRateLimit, getAuthEpoch } from './auth-security-repository'
import { getDatabase, resetDatabaseForTests } from './database'
import { getMfaSetup, saveMfaSetup } from './mfa-setup-repository'
import {
  dismissRecentApplication,
  listDismissedRecentApplicationIds,
  listRecentApplications,
  rememberRecentApplication
} from './recent-applications-repository'

vi.mock('@/server/users/revoke-viewer-sessions', () => ({
  revokeViewerSessionsForUsers: vi.fn().mockResolvedValue(undefined)
}))

describe('fresh web database', () => {
  let tempDirectory: string

  beforeEach(async () => {
    tempDirectory = await mkdtemp(join(tmpdir(), 'rebroid-web-state-'))
    process.env.WEB_DATABASE_PATH = join(tempDirectory, 'web.sqlite')
    process.env.INITIAL_ADMIN_PASSWORD = 'initial-admin-password'
  })

  afterEach(async () => {
    delete process.env.WEB_DATABASE_PATH
    delete process.env.INITIAL_ADMIN_PASSWORD
    resetDatabaseForTests()
    await rm(tempDirectory, { recursive: true, force: true })
  })

  it('creates only the clean schema', () => {
    const tables = getDatabase()
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all() as Array<{ name: string }>
    expect(tables.map(table => table.name)).toEqual([
      'account_sessions',
      'audit_events',
      'auth_state',
      'group_memberships',
      'groups',
      'login_rate_limits',
      'mfa_setup_tokens',
      'recent_applications',
      'users',
      'web_maintenance_jobs',
      'web_settings'
    ])
  })

  it('refuses an incompatible schema instead of upgrading it', () => {
    const path = process.env.WEB_DATABASE_PATH as string
    const legacy = new Database(path)
    legacy.exec('CREATE TABLE legacy_state (value TEXT); PRAGMA user_version = 2;')
    legacy.close()

    expect(() => getDatabase()).toThrow('pnpm reset:all-state -- --execute')
  })

  it('rolls back an interrupted schema creation and can retry', () => {
    const probe = new Database(process.env.WEB_DATABASE_PATH)
    try {
      probe.exec('CREATE VIEW users AS SELECT 1 AS id')
      expect(() => getDatabase()).toThrow()
      expect(probe.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all()).toEqual([])
      probe.exec('DROP VIEW users')
      expect(getDatabase().prepare('SELECT COUNT(*) FROM users').pluck().get()).toBe(0)
    } finally {
      probe.close()
    }
  })

  it('keeps the previous database usable when switching paths fails', () => {
    const original = process.env.WEB_DATABASE_PATH!
    const first = getDatabase()
    process.env.WEB_DATABASE_PATH = join(tempDirectory, 'other.sqlite')
    const legacy = new Database(process.env.WEB_DATABASE_PATH)
    legacy.pragma('user_version = 2')
    legacy.close()

    expect(() => getDatabase()).toThrow('Unsupported web database schema version 2')
    process.env.WEB_DATABASE_PATH = original
    expect(getDatabase()).toBe(first)
    expect(getDatabase().prepare('SELECT 1').pluck().get()).toBe(1)
  })

  it('stores settings transactionally', async () => {
    await Promise.all([
      saveWebSettings({ removeDataOnDelete: false }),
      saveWebSettings({ defaultViewerBitrateMbps: 8 }),
      saveWebSettings({ aiContextualSuggestionsEnabled: false })
    ])
    await expect(getWebSettings()).resolves.toMatchObject({
      removeDataOnDelete: false,
      defaultViewerBitrateMbps: 8,
      aiContextualSuggestionsEnabled: false
    })
  })

  it('keeps five recent applications per user', () => {
    for (let index = 0; index < 6; index += 1) rememberRecentApplication('user-1', `app-${index + 1}`, index)
    expect(listRecentApplications('user-1').map(app => app.id)).toEqual(['app-6', 'app-5', 'app-4', 'app-3', 'app-2'])
  })

  it('remembers sidebar dismissals across history pruning until the account reopens the app', () => {
    rememberRecentApplication('user-1', 'app-1', 1)
    rememberRecentApplication('user-2', 'app-1', 1)
    dismissRecentApplication('user-1', 'app-1')
    for (let index = 2; index < 9; index += 1) rememberRecentApplication('user-1', `app-${index}`, index)
    expect(listDismissedRecentApplicationIds('user-1')).toEqual(new Set(['app-1']))
    expect(listRecentApplications('user-1').map(app => app.id)).not.toContain('app-1')
    expect(listRecentApplications('user-2')).toEqual([{ id: 'app-1', openedAt: 1 }])
    rememberRecentApplication('user-1', 'app-1', 9)
    expect(listDismissedRecentApplicationIds('user-1').size).toBe(0)
    expect(listRecentApplications('user-1')[0]).toEqual({ id: 'app-1', openedAt: 9 })
  })

  it('keeps MFA setup for retained accounts and removes it when an account is deleted', async () => {
    const administrator = await completeTestAdministratorSetup()
    const first = await userService.createUser({ username: 'first', password: 'original-password' }, administrator)
    const second = await userService.createUser({ username: 'second', password: 'original-password' }, administrator)
    const group = await userService.createGroup({ name: 'Extra group' }, administrator)
    saveMfaSetup(first.id, 'first-setup')
    saveMfaSetup(second.id, 'second-setup')

    await userService.updateUser(first.id, { groupIds: [group.id] }, administrator)
    await userService.updateGroup(group.id, { name: 'Renamed group' }, administrator)
    await userService.deleteGroup(group.id, administrator)
    expect(getMfaSetup(first.id)).toBe('first-setup')
    expect(getMfaSetup(second.id)).toBe('second-setup')

    await userService.deleteUser(first.id, administrator)
    expect(getMfaSetup(first.id)).toBeNull()
    expect(getMfaSetup(second.id)).toBe('second-setup')
  })

  it('lists and prunes audit events', () => {
    appendAuditEvent({ actorLabel: 'Zulu', category: 'application', action: 'application.stop' })
    appendAuditEvent({ actorLabel: 'Alpha', category: 'application', action: 'application.start' })
    expect(
      listAuditEvents({}, { sorting: [{ id: 'actorLabel', desc: false }] }).events.map(event => event.actorLabel)
    ).toEqual(['Alpha', 'Zulu'])
    expect(pruneAuditEventsOlderThan(30)).toBe(0)
    expect(purgeAuditEvents()).toBe(2)
  })

  it('protects audit CSV exports from spreadsheet formulas', () => {
    appendAuditEvent({ actorLabel: '=HYPERLINK("https://example.invalid")', category: 'auth', action: 'login' })
    expect(auditEventsToCsv(exportAuditEvents())).toContain("'=HYPERLINK")
  })

  it('searches readable audit labels without widening the selected application scope', () => {
    appendAuditEvent({
      actorLabel: 'Operator',
      category: 'application',
      action: 'application.start',
      resourceType: 'application',
      resourceId: 'app-a'
    })
    appendAuditEvent({
      actorLabel: 'Operator',
      category: 'application',
      action: 'application.start',
      resourceType: 'application',
      resourceId: 'app-b'
    })
    appendAuditEvent({ actorLabel: 'Operator', category: 'auth', action: 'auth.login.success' })
    expect(
      listAuditEvents({ search: 'Start application', resourceType: 'application', resourceId: 'app-a' }).events.map(
        event => event.resourceId
      )
    ).toEqual(['app-a'])
    expect(listAuditEvents({ search: 'Sign in' }).events.map(event => event.action)).toEqual(['auth.login.success'])
    expect(listAuditEvents({ search: "' OR 1=1 --" }).total).toBe(0)
  })

  it('exports matching events in the grid order with a bounded count', () => {
    appendAuditEvent({ actorLabel: 'Zulu', category: 'application', action: 'application.stop', resourceId: 'app-a' })
    appendAuditEvent({ actorLabel: 'Alpha', category: 'application', action: 'application.start', resourceId: 'app-a' })
    appendAuditEvent({ actorLabel: 'Aaron', category: 'application', action: 'application.start', resourceId: 'app-b' })
    expect(
      exportAuditEvents({ resourceId: 'app-a' }, { sorting: [{ id: 'actorLabel', desc: false }], limit: 1 }).map(
        event => event.actorLabel
      )
    ).toEqual(['Alpha'])
    expect(listAuditEvents({ resourceId: 'app-a' }, { page: 999, pageSize: 1 }).page).toBe(2)
    expect(listAuditEvents({ resourceId: 'missing' }, { page: 999 }).page).toBe(1)
  })

  it('provides one current actor label per ID while preserving historical event labels', () => {
    appendAuditEvent({ actorUserId: 'user-a', actorLabel: 'Old name', category: 'auth', action: 'auth.login.success' })
    appendAuditEvent({ actorUserId: 'user-a', actorLabel: 'New name', category: 'auth', action: 'auth.login.success' })
    expect(listAuditFacetValues().actors).toEqual([{ id: 'user-a', label: 'New name' }])
    expect(listAuditEvents().events.map(event => event.actorLabel)).toEqual(['New name', 'Old name'])
  })

  it('resolves usernames for events that only recorded the actor ID', async () => {
    const administrator = await completeTestAdministratorSetup()
    const actor = await userService.createUser(
      { username: 'warehouse-operator', password: 'original-password' },
      administrator
    )
    appendAuditEvent({
      actorUserId: actor.id,
      category: 'application',
      action: 'application.start',
      resourceId: 'app-a'
    })
    expect(listAuditEvents({ search: 'warehouse-operator', resourceId: 'app-a' }).events).toMatchObject([
      { actorUserId: actor.id, actorUsername: actor.username }
    ])
    expect(listAuditFacetValues().actors).toContainEqual({ id: actor.id, label: actor.username })
  })

  it('persists authentication epochs and login rate limits', () => {
    expect(getAuthEpoch()).toBe(getAuthEpoch())
    expect(consumePersistentRateLimit('account', 2, 60_000)).toBe(true)
    expect(consumePersistentRateLimit('account', 2, 60_000)).toBe(true)
    expect(consumePersistentRateLimit('account', 2, 60_000)).toBe(false)
  })

  it('parses and serializes allowlisted audit sorting', () => {
    expect(auditSortFromSearchParams({ sort: 'actorLabel:asc,unknown:desc,createdAt:desc' })).toEqual([
      { id: 'actorLabel', desc: false },
      { id: 'createdAt', desc: true }
    ])
    expect(serializeSortParam([{ id: 'outcome', desc: true }])).toBe('outcome:desc')
  })
})
