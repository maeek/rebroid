import { getDisplayErrorMessage } from '@/lib/error-utils'
import { ActionResultError, isActionFailure } from './action-result'
import type { ActionResult } from './action-result'

type BulkResult = PromiseSettledResult<unknown> | ActionResult<unknown>

const bulkFailure = (result: BulkResult): { error: unknown } | undefined => {
  if ('status' in result && result.status === 'rejected') return { error: result.reason }
  const value = 'status' in result ? result.value : result
  return isActionFailure(value) ? { error: new ActionResultError(value.error) } : undefined
}

export const successfulBulkIds = (items: readonly { id: string }[], results: readonly BulkResult[]) =>
  new Set(items.filter((_, index) => results[index] && !bulkFailure(results[index])).map(item => item.id))

export const summarizeBulkResults = (
  results: readonly BulkResult[],
  successTitle: string,
  failureTitle: string
): { title: string; description?: string; variant?: 'danger' } => {
  const failures = results.flatMap(result => bulkFailure(result) ?? [])
  if (!failures.length) return { title: successTitle }

  const succeeded = results.length - failures.length
  const message = getDisplayErrorMessage(failures[0].error)
  const count = `${succeeded} succeeded, ${failures.length} failed.`
  return {
    title: failureTitle,
    description: results.length > 1 ? `${count} ${message}` : message,
    variant: 'danger'
  }
}
