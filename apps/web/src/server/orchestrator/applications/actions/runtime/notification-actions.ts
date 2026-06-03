'use server'

import { orchestratorAppRuntimeClient } from '../../runtime-client'
import { assertCanUseOwnedApplicationRuntime, ownedRuntimeMessage } from '../common/action-helpers'

export const getAndroidNotificationsAction = async (id: string) => {
  await assertCanUseOwnedApplicationRuntime(id, ownedRuntimeMessage)
  return orchestratorAppRuntimeClient.getNotifications(id)
}
