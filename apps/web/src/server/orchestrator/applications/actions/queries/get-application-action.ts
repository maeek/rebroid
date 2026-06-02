'use server'

import { sanitizeAndroidApplicationForUser } from '../../safety'
import {
  getSanitizedAccessibleApplication,
  assertCanUseOwnedApplicationRuntime,
  ownedRuntimeMessage
} from '../common/action-helpers'

export const getApplicationAction = async (id: string) => {
  return getSanitizedAccessibleApplication(id)
}

export const getOwnedApplicationAction = async (id: string) => {
  const { app, user } = await assertCanUseOwnedApplicationRuntime(id, ownedRuntimeMessage)
  return sanitizeAndroidApplicationForUser(app, user)
}
