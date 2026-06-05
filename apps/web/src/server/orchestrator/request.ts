import 'server-only'
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
    readonly status: number
  ) {
    super(message)
    this.name = 'OrchestratorRequestError'
  }
}

const hasRequestBody = (init?: RequestInit) => init?.body !== undefined && init.body !== null

const isFormDataBody = (body: BodyInit | null | undefined) =>
  typeof FormData !== 'undefined' && body instanceof FormData

const isStreamBody = (body: BodyInit | null | undefined) =>
  typeof ReadableStream !== 'undefined' && body instanceof ReadableStream

const defaultHeadersFor = (init?: RequestInit) => {
  const body = init?.body
  const shouldSendJsonContentType = hasRequestBody(init) && !isFormDataBody(body) && !isStreamBody(body)

  return {
    accept: 'application/json',
    ...(shouldSendJsonContentType ? { 'content-type': 'application/json' } : {}),
    ...(orchestratorSharedSecret ? { [secretHeaderName]: orchestratorSharedSecret } : {}),
    ...init?.headers
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(getOrchestratorApiUrl(path), {
      ...init,
      cache: 'no-store',
      headers: defaultHeadersFor(init)
    })
  } catch (error) {
    throw new OrchestratorRequestError(
      `Orchestrator request failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      502
    )
  }

  if (!response.ok) {
    const error: unknown = await response.json().catch(() => ({ message: response.statusText }))
    throw new OrchestratorRequestError(getErrorMessage(error, response.statusText), response.status)
  }

  if (response.status === 204) return undefined as T

  const text = await response.text()
  if (!text.trim()) return undefined as T

  return JSON.parse(text) as T
}

export async function responseRequest(path: string, init?: RequestInit): Promise<Response> {
  let response: Response
  try {
    response = await fetch(getOrchestratorApiUrl(path), {
      ...init,
      cache: 'no-store',
      headers: defaultHeadersFor(init)
    })
  } catch (error) {
    throw new OrchestratorRequestError(
      `Orchestrator request failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      502
    )
  }

  if (!response.ok) {
    const error: unknown = await response.json().catch(() => ({ message: response.statusText }))
    throw new OrchestratorRequestError(getErrorMessage(error, response.statusText), response.status)
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
