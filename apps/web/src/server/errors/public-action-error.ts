import 'server-only'
import type { OperationErrorCode } from '@/shared/actions/action-result'

interface PublicActionErrorOptions {
  code: OperationErrorCode
  status?: number
  fieldErrors?: Record<string, string[]>
}

export class PublicActionError extends Error {
  readonly code: OperationErrorCode
  readonly status?: number
  readonly fieldErrors?: Record<string, string[]>

  constructor(message: string, { code, status, fieldErrors }: PublicActionErrorOptions) {
    super(message)
    this.name = 'PublicActionError'
    this.code = code
    this.status = status
    this.fieldErrors = fieldErrors
  }
}
