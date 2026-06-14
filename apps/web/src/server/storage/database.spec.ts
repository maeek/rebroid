import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals'
import { auditSortFromSearchParams, auditSortToSearchParam } from '@/server/audit/query'
import { forgetStoredRecentApp, listStoredRecentApps, rememberStoredRecentApp } from '@/server/recent-apps/store'
import { getWebSettings, saveWebSettings } from '@/server/web-settings/store'
import {
  appendAuditEvent,
  corruptWebStateForTests,
  listAuditEvents,
  pruneAuditEventsOlderThan,
  purgeAuditEvents,
  readWebState,
  resetWebDatabaseForTests
} from './database'

describe('web state database', () => {
  let tempDirectory: string

  beforeEach(async () => {
    tempDirectory = await mkdtemp(join(tmpdir(), 'rebroid-web-state-'))
    process.env.WEB_DATABASE_PATH = join(tempDirectory, 'web.sqlite')
  })

  afterEach(async () => {
    delete process.env.WEB_DATABASE_PATH
    resetWebDatabaseForTests()
    await rm(tempDirectory, { recursive: true, force: true })
  })

  it('stores web settings transactionally', async () => {
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

  it('preserves concurrent recent application updates', async () => {
    await Promise.all([
      rememberStoredRecentApp('user-1', 'app-1'),
      rememberStoredRecentApp('user-1', 'app-2'),
      rememberStoredRecentApp('user-1', 'app-3')
    ])
    await forgetStoredRecentApp('user-1', 'app-2')

    await expect(listStoredRecentApps('user-1')).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'app-1' }), expect.objectContaining({ id: 'app-3' })])
    )
  })

  it('keeps five recent applications per user', async () => {
    for (let index = 0; index < 6; index += 1) {
      await rememberStoredRecentApp('user-1', `app-${index + 1}`)
    }

    await expect(listStoredRecentApps('user-1')).resolves.toHaveLength(5)
  })

  it('does not hide corrupted state', async () => {
    corruptWebStateForTests('web-settings', '{malformed')

    await expect(getWebSettings()).rejects.toThrow()
    expect(readWebState('web-settings')).toBe('{malformed')
  })

  it('lists audit events newest first with server-side filters', () => {
    appendAuditEvent({
      actorUserId: 'user-1',
      actorLabel: 'User One',
      category: 'application',
      action: 'application.start',
      resourceType: 'application',
      resourceId: 'app-1'
    })
    appendAuditEvent({
      actorUserId: 'admin-1',
      actorLabel: 'Admin',
      category: 'docker',
      action: 'docker.prune.images',
      resourceType: 'docker_image',
      details: { danglingOnly: true }
    })

    const result = listAuditEvents({ category: 'docker' }, { pageSize: 1 })
    expect(result.total).toBe(1)
    expect(result.events).toEqual([
      expect.objectContaining({
        actorUserId: 'admin-1',
        actorLabel: 'Admin',
        action: 'docker.prune.images',
        category: 'docker',
        details: { danglingOnly: true }
      })
    ])
  })

  it('sorts audit events with allowlisted server-side fields', () => {
    appendAuditEvent({
      actorUserId: 'user-2',
      actorLabel: 'Zulu',
      category: 'application',
      action: 'application.stop'
    })
    appendAuditEvent({
      actorUserId: 'user-1',
      actorLabel: 'Alpha',
      category: 'application',
      action: 'application.start'
    })

    const result = listAuditEvents({}, { sorting: [{ id: 'actorLabel', desc: false }] })
    expect(result.events.map(event => event.actorLabel)).toEqual(['Alpha', 'Zulu'])
  })

  it('parses and serializes audit sort search params safely', () => {
    expect(auditSortFromSearchParams({ sort: 'actorLabel:asc,unknown:desc,createdAt:desc' })).toEqual([
      { id: 'actorLabel', desc: false },
      { id: 'createdAt', desc: true }
    ])
    expect(auditSortFromSearchParams({})).toEqual([{ id: 'createdAt', desc: true }])
    expect(auditSortToSearchParam([{ id: 'outcome', desc: true }])).toBe('outcome:desc')
  })

  it('purges audit events and prunes by retention', () => {
    appendAuditEvent({ actorLabel: 'Admin', category: 'audit', action: 'audit.old' })
    const deleted = pruneAuditEventsOlderThan(30)
    expect(deleted).toBe(0)
    expect(purgeAuditEvents()).toBe(1)
    expect(listAuditEvents().total).toBe(0)
  })
})
