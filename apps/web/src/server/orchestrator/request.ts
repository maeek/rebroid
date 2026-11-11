import 'server-only'
import { logger } from '@/server/observability/logger'
import { getRequestId } from '@/server/observability/request-id'
import { getOrchestratorApiUrl } from '@/server/orchestrator/config'

const secretHeaderName = 'x-orchestrator-secret'
const orchestratorSharedSecret = process.env.ORCHESTRATOR_SHARED_SECRET?.trim()

const getErrorMessage = (error: unknown, fallback: string) => {
  if (!error || typeof error !== 'object' || !('message' in error)) {
    return fallback
  }

  const message = error.message
  if (Array.isArray(message)) {
    return message.join(', ')
  }

  return typeof message === 'string' ? message : fallback
}

export class OrchestratorRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly requestId = 'unknown',
    readonly details?: { code?: string; fields?: string[] }
  ) {
    super(message)
    this.name = 'OrchestratorRequestError'
  }
}

const parseResponseError = (response: Response, text: string, requestId: string) => {
  let body: unknown
  try {
    body = JSON.parse(text) as unknown
  } catch {
    body = null
  }
  const details = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  return new OrchestratorRequestError(getErrorMessage(body, response.statusText), response.status, requestId, {
    code: typeof details.code === 'string' ? details.code : undefined,
    fields: Array.isArray(details.fields) ? details.fields.filter(field => typeof field === 'string') : undefined
  })
}

interface OrchestratorRequestInit extends RequestInit {
  timeoutMs?: number
}

type RuntimeParser<T> = ((value: unknown) => T) | { parse: (value: unknown) => T }

const parseRuntimeValue = <T>(value: unknown, parser?: RuntimeParser<T>): T => {
  if (!parser) return value as T
  return typeof parser === 'function' ? parser(value) : parser.parse(value)
}

const defaultTimeoutMs = (method = 'GET') => {
  const normalized = method.toUpperCase()
  if (normalized === 'GET' || normalized === 'HEAD') return 10_000
  return 30_000
}

const deadlineSignal = (signal: AbortSignal | null | undefined, timeoutMs: number) => {
  const timeoutSignal = AbortSignal.timeout(timeoutMs)
  return signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal
}

const hasRequestBody = (init?: RequestInit) => init?.body !== undefined && init.body !== null

const isFormDataBody = (body: BodyInit | null | undefined) =>
  typeof FormData !== 'undefined' && body instanceof FormData

const isStreamBody = (body: BodyInit | null | undefined) =>
  typeof ReadableStream !== 'undefined' && body instanceof ReadableStream

const defaultHeadersFor = (init: RequestInit | undefined, requestId: string) => {
  const body = init?.body
  const shouldSendJsonContentType = hasRequestBody(init) && !isFormDataBody(body) && !isStreamBody(body)

  return {
    accept: 'application/json',
    ...(shouldSendJsonContentType ? { 'content-type': 'application/json' } : {}),
    ...Object.fromEntries(new Headers(init?.headers)),
    'x-request-id': requestId,
    ...(orchestratorSharedSecret ? { [secretHeaderName]: orchestratorSharedSecret } : {})
  }
}

const errorHasTimedOut = (error: unknown) => error instanceof Error && error.name === 'TimeoutError'

const transportError = (error: unknown, path: string, method: string, requestId: string, signal: AbortSignal) => {
  logger.error('orchestrator.request_failed', {
    requestId,
    path: path.split('?')[0],
    method,
    errorName: error instanceof Error ? error.name : 'UnknownError'
  })
  return new OrchestratorRequestError(
    `Orchestrator request failed: ${error instanceof Error ? error.message : 'unknown error'}`,
    errorHasTimedOut(error) || errorHasTimedOut(signal.reason) ? 504 : 502,
    requestId
  )
}

const fetchResponse = async (path: string, init?: OrchestratorRequestInit) => {
  const requestId = await getRequestId(new Headers(init?.headers).get('x-request-id'))
  const { timeoutMs = defaultTimeoutMs(init?.method), ...requestInit } = init ?? {}
  const method = requestInit.method ?? 'GET'
  const signal = deadlineSignal(requestInit.signal, timeoutMs)
  let response: Response
  try {
    response = await fetch(getOrchestratorApiUrl(path), {
      ...requestInit,
      cache: 'no-store',
      headers: defaultHeadersFor(requestInit, requestId),
      signal
    })
  } catch (error) {
    throw transportError(error, path, method, requestId, signal)
  }

  if (!response.ok) {
    const body = await readResponseBody(response, path, method, requestId, signal)
    throw parseResponseError(response, body, requestId)
  }
  return { response, requestId, method, signal }
}

const readResponseBody = async (
  response: Response,
  path: string,
  method: string,
  requestId: string,
  signal: AbortSignal
) => {
  try {
    return await response.text()
  } catch (error) {
    throw transportError(error, path, method, requestId, signal)
  }
}

export async function request<T>(path: string, init?: OrchestratorRequestInit, parser?: RuntimeParser<T>): Promise<T> {
  const { response, requestId, method, signal } = await fetchResponse(path, init)
  const body = await readResponseBody(response, path, method, requestId, signal)
  try {
    return parseRuntimeValue(JSON.parse(body) as unknown, parser)
  } catch (error) {
    logger.error('orchestrator.invalid_response', {
      requestId,
      path: path.split('?')[0],
      method,
      errorName: error instanceof Error ? error.name : 'UnknownError'
    })
    throw new OrchestratorRequestError('The orchestrator returned an invalid response.', 502, requestId)
  }
}

export async function requestVoid(path: string, init?: OrchestratorRequestInit): Promise<void> {
  const { response, requestId, method, signal } = await fetchResponse(path, init)
  await readResponseBody(response, path, method, requestId, signal)
}

export async function responseRequest(path: string, init?: OrchestratorRequestInit): Promise<Response> {
  return (await fetchResponse(path, init)).response
}

export const emptyRequest = <T>(path: string, init?: Omit<RequestInit, 'body'>) => request<T>(path, init)

export const jsonRequest = <T>(
  path: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body: unknown,
  init?: Omit<OrchestratorRequestInit, 'method' | 'body'>
) =>
  request<T>(path, {
    ...init,
    method,
    body: JSON.stringify(body)
  })

export const formRequest = <T>(
  path: string,
  method: 'POST' | 'PUT' | 'PATCH',
  body: FormData,
  init?: Omit<RequestInit, 'method' | 'body'>
) =>
  request<T>(path, {
    ...init,
    method,
    body
  })

export const streamRequest = <T>(
  path: string,
  method: 'POST' | 'PUT' | 'PATCH',
  body: ReadableStream<Uint8Array>,
  contentType: string,
  init?: Omit<RequestInit, 'method' | 'body' | 'headers'>
) =>
  request<T>(path, {
    ...init,
    method,
    body,
    headers: { 'content-type': contentType },
    duplex: 'half'
  } as RequestInit & { duplex: 'half' })
