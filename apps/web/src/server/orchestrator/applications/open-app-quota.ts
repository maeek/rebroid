import 'server-only'
import { PublicActionError } from '@/server/errors/public-action-error'
import { OrchestratorRequestError } from '../request'

export const openAppQuotaHeaders = (limit: number | null | undefined): Record<string, string> =>
  limit == null ? {} : { 'x-rebroid-max-open-apps': String(Math.min(Math.ceil(limit), Number.MAX_SAFE_INTEGER)) }

export const throwOpenAppQuotaError = (error: unknown): never => {
  if (error instanceof OrchestratorRequestError && error.details?.code === 'open_app_quota_exceeded') {
    throw new PublicActionError('Open app limit reached. Stop an app before starting another.', {
      code: 'conflict',
      status: 409
    })
  }
  throw error
}
