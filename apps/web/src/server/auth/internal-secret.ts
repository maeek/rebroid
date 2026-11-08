import { timingSafeEqual } from 'node:crypto'
import 'server-only'

export const hasInternalSecret = (headers: Headers) => {
  const expected = process.env.ORCHESTRATOR_SHARED_SECRET?.trim()
  const actual = headers.get('x-orchestrator-secret')
  if (!expected || !actual) return false
  const left = Buffer.from(expected)
  const right = Buffer.from(actual)
  return left.length === right.length && timingSafeEqual(left, right)
}
