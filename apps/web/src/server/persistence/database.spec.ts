import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { auditSortFromSearchParams, auditSortToSearchParam } from '@/server/audit/query'
import { userService } from '@/server/auth/user'
import { getWebSettings, saveWebSettings } from '@/server/web-settings/store'
import { appendAuditEvent, listAuditEvents, pruneAuditEventsOlderThan, purgeAuditEvents } from './audit-repository'
import { createAutomationDraft, consumeAutomationDraft } from './automation-drafts-repository'
import { getDatabase, resetDatabaseForTests } from './database'
import {
  forgetRecentApplication,
  listRecentApplications,
  rememberRecentApplication
} from './recent-applications-repository'

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
      'audit_events',
      'automation_drafts',
      'group_memberships',
      'groups',
      'recent_applications',
      'users',
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
    forgetRecentApplication('user-1', 'app-5')
    expect(listRecentApplications('user-1')).toHaveLength(4)
  })

  it('consumes automation drafts once and only for their owner', async () => {
    const owner = await userService.createUser({ username: 'owner', password: 'original-password' })
    const draft = createAutomationDraft(owner.id, 'name: draft', 'run-1')
    expect(consumeAutomationDraft('another-user', draft.token)).toBeNull()
    expect(consumeAutomationDraft(owner.id, draft.token)).toMatchObject({ yaml: 'name: draft', sourceRunId: 'run-1' })
    expect(consumeAutomationDraft(owner.id, draft.token)).toBeNull()
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

  it('parses and serializes allowlisted audit sorting', () => {
    expect(auditSortFromSearchParams({ sort: 'actorLabel:asc,unknown:desc,createdAt:desc' })).toEqual([
      { id: 'actorLabel', desc: false },
      { id: 'createdAt', desc: true }
    ])
    expect(auditSortToSearchParam([{ id: 'outcome', desc: true }])).toBe('outcome:desc')
  })
})
