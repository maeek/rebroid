import { PublicActionError } from '@/server/errors/public-action-error'
import { isApplicationId } from '@/shared/model/application-id'

export const applicationPath = (id: string) => {
  if (!isApplicationId(id)) {
    throw new PublicActionError('Application not found.', { code: 'not_found', status: 404 })
  }
  return `/apps/${encodeURIComponent(id)}`
}

export const encodeApplicationPathSegment = (value: string) => {
  // The URL parser normalizes dot segments even if their dots are percent-encoded.
  if (typeof value !== 'string' || !value || value === '.' || value === '..') {
    throw new PublicActionError('Invalid application path selector.', { code: 'validation', status: 400 })
  }
  return encodeURIComponent(value)
}
