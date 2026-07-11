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
    readonly requestId = 'unknown'
  ) {
    super(message)
    this.name = 'OrchestratorRequestError'
  }
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
    'x-request-id': requestId,
    ...(shouldSendJsonContentType ? { 'content-type': 'application/json' } : {}),
    ...(orchestratorSharedSecret ? { [secretHeaderName]: orchestratorSharedSecret } : {}),
    ...init?.headers
  }
}

export async function request<T>(path: string, init?: OrchestratorRequestInit, parser?: RuntimeParser<T>): Promise<T> {
  const requestId = await getRequestId(new Headers(init?.headers).get('x-request-id'))
  const { timeoutMs = defaultTimeoutMs(init?.method), ...requestInit } = init ?? {}
  let response: Response
  try {
    response = await fetch(getOrchestratorApiUrl(path), {
      ...requestInit,
      cache: 'no-store',
      headers: defaultHeadersFor(requestInit, requestId),
      signal: deadlineSignal(requestInit.signal, timeoutMs)
    })
  } catch (error) {
    logger.error('orchestrator.request_failed', {
      requestId,
      path,
      method: requestInit.method ?? 'GET',
      errorName: error instanceof Error ? error.name : 'UnknownError'
    })
    throw new OrchestratorRequestError(
      `Orchestrator request failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      error instanceof Error && error.name === 'TimeoutError' ? 504 : 502,
      requestId
    )
  }

  if (!response.ok) {
    const error: unknown = await response.json().catch(() => ({ message: response.statusText }))
    throw new OrchestratorRequestError(getErrorMessage(error, response.statusText), response.status, requestId)
  }

  if (response.status === 204) return undefined as T

  const text = await response.text()
  if (!text.trim()) return undefined as T

  try {
    return parseRuntimeValue(JSON.parse(text) as unknown, parser)
  } catch (error) {
    logger.error('orchestrator.invalid_response', {
      requestId,
      path,
      method: requestInit.method ?? 'GET',
      errorName: error instanceof Error ? error.name : 'UnknownError'
    })
    throw new OrchestratorRequestError('The orchestrator returned an invalid response.', 502, requestId)
  }
}

export async function responseRequest(path: string, init?: OrchestratorRequestInit): Promise<Response> {
  const requestId = await getRequestId(new Headers(init?.headers).get('x-request-id'))
  const { timeoutMs = defaultTimeoutMs(init?.method), ...requestInit } = init ?? {}
  let response: Response
  try {
    response = await fetch(getOrchestratorApiUrl(path), {
      ...requestInit,
      cache: 'no-store',
      headers: defaultHeadersFor(requestInit, requestId),
      signal: deadlineSignal(requestInit.signal, timeoutMs)
    })
  } catch (error) {
    throw new OrchestratorRequestError(
      `Orchestrator request failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      error instanceof Error && error.name === 'TimeoutError' ? 504 : 502,
      requestId
    )
  }

  if (!response.ok) {
    const error: unknown = await response.json().catch(() => ({ message: response.statusText }))
    throw new OrchestratorRequestError(getErrorMessage(error, response.statusText), response.status, requestId)
  }

  return response
}

export const emptyRequest = <T>(path: string, init?: Omit<RequestInit, 'body'>) => request<T>(path, init)

export const jsonRequest = <T>(
  path: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body: unknown,
  init?: Omit<RequestInit, 'method' | 'body'>
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
