import { describe, expect, it } from 'vitest'
import {
  automationStatusLabel,
  automationTriggerAppIdsByAutomationId,
  buildAutomationsGridHref,
  countActiveAutomationFilters,
  countAutomationSteps,
  deletedAutomationIdsFromResults,
  retainPageAutomationSelection,
  selectedAutomationsFromIds,
  summarizeAutomationDeleteResults
} from './automations-table-model'
import type { Automation, AutomationTrigger } from '@/server/orchestrator/automations/types'
import type { AutomationDefinitionStep } from '@rebroid/automation-core/definition'

const automation = (id: string): Automation => ({ id, name: id }) as Automation

describe('automations table model', () => {
  it('labels workflow statuses for display', () => {
    expect(automationStatusLabel('never_run')).toBe('Never run')
    expect(automationStatusLabel('success')).toBe('Success')
    expect(automationStatusLabel('running')).toBe('Running')
    expect(automationStatusLabel('failed')).toBe('Failed')
  })

  it('counts nested automation steps', () => {
    const steps = [
      { id: 'one', uses: 'android.wait', with: {} },
      {
        id: 'condition',
        type: 'condition',
        if: 'true',
        then: [{ id: 'then', uses: 'android.tap', with: {} }],
        else: [{ id: 'else', uses: 'android.key', with: {} }]
      },
      {
        id: 'switch',
        type: 'switch',
        value: '${{ value }}',
        cases: [{ when: 'a', steps: [{ id: 'case', uses: 'android.wait', with: {} }] }],
        default: [{ id: 'default', uses: 'android.wait', with: {} }]
      }
    ] as unknown as AutomationDefinitionStep[]

    expect(countAutomationSteps(steps)).toBe(7)
  })

  it('groups trigger target app ids by automation', () => {
    const triggers = [
      { automationId: 'a', targetApplicationId: 'app-1' },
      { automationId: 'a', targetApplicationId: 'app-2' },
      { automationId: 'b', targetApplicationId: 'app-1' }
    ] as AutomationTrigger[]

    const grouped = automationTriggerAppIdsByAutomationId(triggers)

    expect([...(grouped.get('a') ?? [])]).toEqual(['app-1', 'app-2'])
    expect([...(grouped.get('b') ?? [])]).toEqual(['app-1'])
  })

  it('retains and derives current page selection', () => {
    const automations = [automation('a'), automation('c')]
    const selectedIds = new Set(['a', 'b', 'c'])

    expect([...retainPageAutomationSelection(automations, selectedIds)]).toEqual(['a', 'c'])
    expect(selectedAutomationsFromIds(automations, selectedIds)).toEqual(automations)
  })

  it('counts active filters and extracts fulfilled delete ids', () => {
    expect(countActiveAutomationFilters({ tag: 'smoke', status: 'failed' })).toBe(2)
    expect([
      ...deletedAutomationIdsFromResults(
        [automation('a'), automation('b')],
        [
          { status: 'fulfilled', value: undefined },
          { status: 'rejected', reason: new Error('failed') }
        ]
      )
    ]).toEqual(['a'])
  })

  it('builds compact workflow grid hrefs', () => {
    expect(
      buildAutomationsGridHref({
        gridQuery: {
          q: 'smoke',
          tag: 'nightly',
          targetApplicationId: 'app-1',
          status: 'failed',
          lastRun: 'all',
          sort: 'updatedAt:desc',
          page: 3,
          pageSize: 25
        },
        pageSize: 25,
        patch: { q: '', page: 1 }
      })
    ).toBe('/automations?tag=nightly&targetApplicationId=app-1&status=failed&sort=updatedAt%3Adesc&page=1&pageSize=25')
  })

  it('summarizes workflow delete results', () => {
    const fulfilledResults = [{ status: 'fulfilled', value: undefined }] satisfies PromiseSettledResult<unknown>[]
    const mixedResults = [
      { status: 'fulfilled', value: undefined },
      { status: 'rejected', reason: new Error('failed') }
    ] satisfies PromiseSettledResult<unknown>[]

    expect(summarizeAutomationDeleteResults([automation('a')], new Set(['a']), fulfilledResults)).toEqual({
      title: 'Workflow deleted'
    })
    expect(
      summarizeAutomationDeleteResults([automation('a'), automation('b')], new Set(['a', 'b']), [
        { status: 'fulfilled', value: undefined },
        { status: 'fulfilled', value: undefined }
      ])
    ).toEqual({ title: 'Selected workflows deleted' })
    expect(summarizeAutomationDeleteResults([automation('a'), automation('b')], new Set(['a']), mixedResults)).toEqual({
      title: 'Some workflows could not be deleted',
      description: '1 delete request failed.',
      variant: 'danger'
    })
  })
})
