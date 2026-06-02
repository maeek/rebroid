'use server'

import { orchestratorApplicationsClient } from '../../client'
import { assertCanUseOwnedApplicationRuntime, ownedRuntimeMessage } from '../common/action-helpers'

export const getAndroidNotificationsAction = async (id: string) => {
  await assertCanUseOwnedApplicationRuntime(id, ownedRuntimeMessage)
  return orchestratorApplicationsClient.getNotifications(id)
}
