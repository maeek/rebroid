import { defaultSchedule } from '@rebroid/automation-core/schedule'
import { describe, expect, it } from 'vitest'
import {
  activeTriggerFilterCount,
  applyTriggerTargetApplication,
  buildAutomationTriggersGridHref,
  defaultTriggerName,
  deletedTriggerIdsFromResults,
  editTriggerFormState,
  hasActiveTriggerFilters,
  newTriggerFormState,
  retainVisibleTriggerSelection,
  selectedTriggersFromIds,
  summarizeTriggerBulkDeleteResults,
  summarizeTriggerBulkUpdateResults,
  triggerFormSavePayload
} from './automation-triggers-page-model'
import type { TriggerFormState } from './automation-trigger-types'
import type { AndroidApplication } from '@/server/orchestrator/applications/types'
import type {
  Automation,
  AutomationTrigger,
  AutomationTriggersGridQuery
} from '@/server/orchestrator/automations/types'

const automation = {
  id: 'automation-1',
  name: 'Daily smoke test'
} as unknown as Automation

const app = (id = 'app-1', overrides: Partial<AndroidApplication> = {}): AndroidApplication =>
  ({
    id,
    name: 'Pixel 9',
    storage: {
      volumeName: `volume-${id}`,
      profileMode: 'persistent',
      profileName: 'default',
      savedProfiles: []
    },
    ...overrides
  }) as unknown as AndroidApplication

const trigger = (id = 'trigger-1', overrides: Partial<AutomationTrigger> = {}): AutomationTrigger =>
  ({
    id,
    name: 'Morning run',
    automationId: 'automation-1',
    targetApplicationId: 'app-1',
    profileMode: null,
    profileName: null,
    enabled: true,
    tags: ['smoke'],
    triggerType: 'schedule',
    triggerConfig: {
      cronExpression: '0 9 * * *',
      startPolicy: 'require-running'
    },
    lastRunAt: null,
    nextRunAt: null,
    lastStatus: 'never_run',
    lastError: null,
    ...overrides
  }) as unknown as AutomationTrigger

describe('automation triggers page model', () => {
  it('creates default form state from the first automation and app', () => {
    expect(newTriggerFormState({ automation, app: app() })).toMatchObject({
      name: 'Daily smoke test on Pixel 9',
      automationId: 'automation-1',
      targetApplicationId: 'app-1',
      profileMode: 'persistent',
      profileName: 'default',
      enabled: true,
      tags: [],
      schedule: defaultSchedule,
      startPolicy: 'start-if-needed'
    })
    expect(defaultTriggerName(undefined, undefined)).toBe('New workflow trigger')
  })

  it('hydrates edit form state from trigger data and app defaults', () => {
    expect(
      editTriggerFormState({
        trigger: trigger(),
        app: app()
      })
    ).toMatchObject({
      id: 'trigger-1',
      name: 'Morning run',
      automationId: 'automation-1',
      targetApplicationId: 'app-1',
      profileMode: 'persistent',
      profileName: 'default',
      enabled: true,
      tags: ['smoke'],
      startPolicy: 'require-running'
    })
  })

  it('updates target application profile defaults in an existing form', () => {
    const form = newTriggerFormState({ automation, app: app('app-1') })
    const nextApp = app('app-2', {
      storage: {
        volumeName: 'volume-app-2',
        profileMode: 'temporary',
        profileName: 'qa',
        savedProfiles: []
      }
    } as unknown as Partial<AndroidApplication>)

    expect(applyTriggerTargetApplication(form, 'app-2', nextApp)).toMatchObject({
      targetApplicationId: 'app-2',
      profileMode: 'temporary',
      profileName: 'qa'
    })
  })

  it('builds save payloads with normalized names and profile fallback', () => {
    const form: TriggerFormState = {
      ...newTriggerFormState({ automation, app: app() }),
      name: '  Trim me  ',
      profileName: '   '
    }

    expect(triggerFormSavePayload(form)).toMatchObject({
      name: 'Trim me',
      automationId: 'automation-1',
      targetApplicationId: 'app-1',
      profileName: 'default',
      triggerType: 'schedule',
      triggerConfig: {
        startPolicy: 'start-if-needed'
      }
    })
  })

  it('derives active filters and selection state', () => {
    const query: AutomationTriggersGridQuery = {
      q: 'smoke',
      enabled: 'true',
      status: 'success'
    }
    const triggers = [trigger('a'), trigger('b'), trigger('c')]
    const selectedIds = new Set(['a', 'missing', 'c'])

    expect(hasActiveTriggerFilters(query)).toBe(true)
    expect(activeTriggerFilterCount(query)).toBe(2)
    expect([...retainVisibleTriggerSelection(triggers, selectedIds)]).toEqual(['a', 'c'])
    expect(selectedTriggersFromIds(triggers, selectedIds).map(item => item.id)).toEqual(['a', 'c'])
  })

  it('builds compact trigger grid hrefs', () => {
    expect(
      buildAutomationTriggersGridHref({
        gridQuery: {
          q: 'smoke',
          tag: 'nightly',
          targetApplicationId: 'app-1',
          enabled: undefined,
          status: undefined,
          lastRun: 'all',
          sort: 'updatedAt:desc',
          page: 4,
          pageSize: 50
        },
        pageSize: 50,
        patch: { q: '', enabled: 'true', page: 1 }
      })
    ).toBe(
      '/automations/triggers?tag=nightly&targetApplicationId=app-1&enabled=true&sort=updatedAt%3Adesc&page=1&pageSize=50'
    )
  })

  it('extracts fulfilled deleted trigger ids from settled results', () => {
    const triggers = [trigger('a'), trigger('b'), trigger('c')]
    const results = [
      { status: 'fulfilled', value: undefined },
      { status: 'rejected', reason: new Error('failed') },
      { status: 'fulfilled', value: undefined }
    ] satisfies PromiseSettledResult<unknown>[]

    expect([...deletedTriggerIdsFromResults(results, triggers)]).toEqual(['a', 'c'])
  })

  it('summarizes bulk trigger update and delete results', () => {
    const mixedResults = [
      { status: 'fulfilled', value: undefined },
      { status: 'rejected', reason: new Error('failed') }
    ] satisfies PromiseSettledResult<unknown>[]
    const fulfilledResults = [{ status: 'fulfilled', value: undefined }] satisfies PromiseSettledResult<unknown>[]

    expect(summarizeTriggerBulkUpdateResults(fulfilledResults, true)).toEqual({
      title: 'Selected triggers enabled'
    })
    expect(summarizeTriggerBulkUpdateResults(fulfilledResults, false)).toEqual({
      title: 'Selected triggers disabled'
    })
    expect(summarizeTriggerBulkUpdateResults(mixedResults, true)).toEqual({
      title: 'Some triggers could not be updated',
      description: '1 update request failed.',
      variant: 'danger'
    })
    expect(summarizeTriggerBulkDeleteResults(fulfilledResults, new Set(['a']))).toEqual({
      title: 'Selected triggers deleted'
    })
    expect(summarizeTriggerBulkDeleteResults(mixedResults, new Set(['a']))).toEqual({
      title: 'Some triggers could not be deleted',
      description: '1 delete request failed.',
      variant: 'danger'
    })
  })
})
