import { randomUUID } from 'node:crypto'
import { headers } from 'next/headers'
import 'server-only'

const requestIdPattern = /^[A-Za-z0-9._:-]{1,128}$/

export const normalizeRequestId = (value: string | null | undefined) => {
  const candidate = value?.trim()
  return candidate && requestIdPattern.test(candidate) ? candidate : null
}

export const createRequestId = () => randomUUID()

export const getRequestId = async (explicit?: string | null) => {
  const provided = normalizeRequestId(explicit)
  if (provided) return provided

  try {
    const incoming = normalizeRequestId((await headers()).get('x-request-id'))
    return incoming ?? createRequestId()
  } catch {
    return createRequestId()
  }
}
