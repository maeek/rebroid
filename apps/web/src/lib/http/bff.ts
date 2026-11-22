import { isActionResult, unwrapActionResult } from '@/shared/actions/action-result'

async function requestBff<T>(url: string, options: RequestInit): Promise<T> {
  const response = await fetch(url, options)
  const payload: unknown = await response.json().catch(() => null)
  options.signal?.throwIfAborted()
  if (!isActionResult<T>(payload)) throw new Error('The server returned an invalid response.')
  return unwrapActionResult(payload)
}

export const getBff = <T>(url: string, signal?: AbortSignal) => requestBff<T>(url, { cache: 'no-store', signal })

export const sendBff = <T>(
  url: string,
  body: unknown,
  method: 'POST' | 'PATCH' | 'DELETE' = 'POST',
  signal?: AbortSignal
) =>
  requestBff<T>(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal
  })
