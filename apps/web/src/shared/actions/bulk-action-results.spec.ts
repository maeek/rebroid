import { expect, it } from 'vitest'
import { actionError, actionOk } from './action-result'
import { successfulBulkIds, summarizeBulkResults } from './bulk-action-results'

it('keeps item order across settled, structured, and rejected results', async () => {
  const items = ['a', 'b', 'c', 'd'].map(id => ({ id }))
  const [failed, succeeded, rejected] = await Promise.allSettled([
    Promise.resolve(actionError({ message: 'Unavailable.' }, 'first-ref')),
    Promise.resolve(actionOk('saved')),
    Promise.reject(new Error('offline'))
  ])
  const results = [actionOk('saved'), failed, succeeded, rejected]
  expect([...successfulBulkIds(items, results)]).toEqual(['a', 'c'])
  expect(summarizeBulkResults(results, 'Done', 'Some failed')).toEqual({
    title: 'Some failed',
    description: '2 succeeded, 2 failed. Unavailable. Reference: first-ref',
    variant: 'danger'
  })
})

it('returns the operation title on complete success', () => {
  expect(summarizeBulkResults([actionOk(undefined)], 'Selected triggers deleted', 'Failed')).toEqual({
    title: 'Selected triggers deleted'
  })
})
