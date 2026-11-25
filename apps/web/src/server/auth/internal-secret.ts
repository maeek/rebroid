import { timingSafeEqual } from 'node:crypto'
import 'server-only'

const matchesSecret = (headers: Headers, secret: string | undefined) => {
  const expected = secret?.trim()
  const actual = headers.get('x-orchestrator-secret')
  if (!expected || !actual) return false
  const left = Buffer.from(expected)
  const right = Buffer.from(actual)
  return left.length === right.length && timingSafeEqual(left, right)
}

export const hasInternalSecret = (headers: Headers) => matchesSecret(headers, process.env.ORCHESTRATOR_SHARED_SECRET)

export const hasExternalViewerSecret = (headers: Headers) =>
  matchesSecret(headers, process.env.EXTERNAL_ADB_BROKER_SECRET)
