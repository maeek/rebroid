import { isActionResult, unwrapActionResult } from '@/shared/actions/action-result'

export const getBff = async <T>(url: string, signal?: AbortSignal): Promise<T> => {
  const response = await fetch(url, { cache: 'no-store', signal })
  const payload: unknown = await response.json().catch(() => null)
  if (!isActionResult<T>(payload)) {
    throw new Error('The server returned an invalid response.')
  }
  return unwrapActionResult(payload)
}

export const sendBff = async <T>(url: string, body: unknown, method: 'POST' | 'PATCH' | 'DELETE' = 'POST') => {
  const response = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  })
  const payload: unknown = await response.json().catch(() => null)
  if (!isActionResult<T>(payload)) {
    throw new Error('The server returned an invalid response.')
  }
  return unwrapActionResult(payload)
}
