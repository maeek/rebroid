'use server'

import { applyRedroidDefaultContainerArgs } from '@rebroid/android-application-core/redroid-runtime'
import { allowsBroadInternetAccess } from '@rebroid/firewall-policy-core/policy'
import { runSafeAction } from '@/server/actions/safe-action'
import { recordAuditEvent } from '@/server/audit/events'
import { PublicActionError } from '@/server/errors/public-action-error'
import {
  unconfirmedAppCreationMessage,
  type CreateApplicationActionInput,
  type UpdateAndroidApplicationInput
} from '@/shared/contracts/application'
import { isApplicationId } from '@/shared/model/application-id'
import { hasPermission } from '@/shared/permissions/permissions'
import { getCurrentOwnerUserId, getCurrentUserContext } from '../../../current-user'
import { loadFeatureFlags } from '../../../features'
import { revalidateApplicationDetail, revalidateApplicationList } from '../../../shared'
import { orchestratorAppCatalogClient } from '../../catalog-client'
import { orchestratorAppLifecycleClient } from '../../lifecycle-client'
import { getEnforcedResourceQuota } from '../../resource-quota'
import {
  applyCreateResourceQuotas,
  enforceResourceQuotas,
  enforceSessionQuota,
  sanitizeAndroidApplicationForUser
} from '../../safety'
import { assertCanAccessApplication } from '../common/action-helpers'
import { toCreateApplicationError } from './create-application-error'

const assertCanChangeResources = (
  user: Awaited<ReturnType<typeof getCurrentUserContext>>,
  input: UpdateAndroidApplicationInput
) => {
  if (
    (input.memoryLimitMb !== undefined || input.cpuLimitCpus !== undefined) &&
    !hasPermission(user.permissions, 'applications:change-resources')
  ) {
    throw new PublicActionError('You do not have permission to change resource limits.', {
      code: 'forbidden',
      status: 403
    })
  }
}

const assertCanChangeSessionLimit = (
  user: Awaited<ReturnType<typeof getCurrentUserContext>>,
  input: UpdateAndroidApplicationInput
) => {
  if (
    input.inactivityTimeoutSeconds !== undefined &&
    !hasPermission(user.permissions, 'applications:change-session-limit')
  ) {
    throw new PublicActionError('You do not have permission to change session limits.', {
      code: 'forbidden',
      status: 403
    })
  }
}

const assertCanChangeContainerArgs = (
  user: Awaited<ReturnType<typeof getCurrentUserContext>>,
  input: UpdateAndroidApplicationInput
) => {
  if (input.containerArgs !== undefined && !hasPermission(user.permissions, 'applications:change-container-args')) {
    throw new PublicActionError('You do not have permission to change container arguments.', {
      code: 'forbidden',
      status: 403
    })
  }
}

const assertCanChangeContainerImage = (
  user: Awaited<ReturnType<typeof getCurrentUserContext>>,
  input: CreateApplicationActionInput
) => {
  if (input.containerImage && !hasPermission(user.permissions, 'applications:change-base-image')) {
    throw new PublicActionError('You do not have permission to change the base image.', {
      code: 'forbidden',
      status: 403
    })
  }
}

const assertCanConfigureCreateNetworkPolicy = (
  user: Awaited<ReturnType<typeof getCurrentUserContext>>,
  input: CreateApplicationActionInput
) => {
  if (input.networkPolicyEnabled === undefined && input.networkPolicyAllowCidrs === undefined) {
    return
  }

  if (!hasPermission(user.permissions, 'applications:configure-egress')) {
    throw new PublicActionError('You do not have permission to configure network access.', {
      code: 'forbidden',
      status: 403
    })
  }

  if (
    (input.networkPolicyEnabled === false || allowsBroadInternetAccess(input.networkPolicyAllowCidrs ?? [])) &&
    !hasPermission(user.permissions, 'applications:use-internet')
  ) {
    throw new PublicActionError('You do not have permission to allow broad internet access.', {
      code: 'forbidden',
      status: 403
    })
  }
}

export const updateApplicationAction = async (id: string, input: UpdateAndroidApplicationInput) => {
  await assertCanAccessApplication(id)
  const user = await getCurrentUserContext()
  assertCanChangeResources(user, input)
  assertCanChangeSessionLimit(user, input)
  assertCanChangeContainerArgs(user, input)
  const quotas = await getEnforcedResourceQuota(user.quotas)
  enforceResourceQuotas(input, quotas)
  enforceSessionQuota(input, quotas)
  const command = await orchestratorAppCatalogClient.updateApplication(id, input)
  recordAuditEvent({
    actorUserId: user.ownerUserId,
    actorLabel: user.ownerUserId,
    category: 'application',
    action: 'application.update',
    resourceType: 'application',
    resourceId: id,
    resourceLabel: command.name,
    details: { fields: Object.keys(input) }
  })
  revalidateApplicationDetail(id)
  const app = await orchestratorAppCatalogClient.getApplication(id)
  return sanitizeAndroidApplicationForUser(app, user)
}

// The former action returned a bare app. Use a distinct action name for the operation result.
export const submitCreateApplicationAction = async (input: CreateApplicationActionInput) =>
  runSafeAction(
    async requestId => {
      const user = await getCurrentUserContext()
      if (!hasPermission(user.permissions, 'applications:create')) {
        throw new PublicActionError('You do not have permission to create applications.', {
          code: 'forbidden',
          status: 403
        })
      }
      assertCanChangeContainerImage(user, input)
      assertCanChangeResources(user, input)
      assertCanChangeSessionLimit(user, input)
      assertCanChangeContainerArgs(user, input)
      assertCanConfigureCreateNetworkPolicy(user, input)
      const manifest = await loadFeatureFlags()
      const firewall = manifest?.features.find(feature => feature.key === 'feature.firewall')
      const useUnrestrictedDefault =
        input.networkPolicyEnabled === undefined &&
        input.networkPolicyAllowCidrs === undefined &&
        firewall !== undefined &&
        (!firewall.enabled || !firewall.supported)
      if (useUnrestrictedDefault && !hasPermission(user.permissions, 'applications:use-internet')) {
        throw new PublicActionError(
          'Creating an app while Firewall is unavailable requires unrestricted internet access permission.',
          {
            code: 'forbidden',
            status: 403
          }
        )
      }
      const quotas = await getEnforcedResourceQuota(user.quotas, manifest)
      enforceResourceQuotas(input, quotas)
      enforceSessionQuota(input, quotas)
      const ownerUserId = await getCurrentOwnerUserId()
      const containerImage = input.containerImage?.trim()
      const command = await orchestratorAppCatalogClient
        .createApplication(
          {
            ...applyCreateResourceQuotas(input, quotas),
            ...(useUnrestrictedDefault ? { networkPolicyEnabled: false } : {}),
            ownerUserId,
            containerArgs: containerImage
              ? applyRedroidDefaultContainerArgs(containerImage, input.containerArgs ?? '') || undefined
              : input.containerArgs
          },
          requestId,
          user.quotas.maxOpenApps,
          user
        )
        .catch((error: unknown) => {
          throw toCreateApplicationError(error)
        })
      if (!isApplicationId(command?.id)) {
        throw new PublicActionError(unconfirmedAppCreationMessage, { code: 'upstream_error', status: 502 })
      }
      recordAuditEvent({
        actorUserId: user.ownerUserId,
        actorLabel: user.ownerUserId,
        category: 'application',
        action: 'application.create',
        resourceType: 'application',
        resourceId: command.id,
        resourceLabel: command.name
      })
      revalidateApplicationList()
      return { id: command.id }
    },
    {
      fallbackMessage:
        'Check All apps before retrying. If the app is missing and this keeps happening, share the request ID with a platform administrator.',
      logLabel: 'submitCreateApplicationAction failed'
    }
  )

export const updateApkAction = async (id: string, uploadedApkId: string) => {
  await assertCanAccessApplication(id)
  const user = await getCurrentUserContext()
  if (!hasPermission(user.permissions, 'applications:update-apk')) {
    throw new PublicActionError('You do not have permission to update APKs.', { code: 'forbidden', status: 403 })
  }
  const command = await orchestratorAppLifecycleClient.updateApk(id, uploadedApkId)
  recordAuditEvent({
    actorUserId: user.ownerUserId,
    actorLabel: user.ownerUserId,
    category: 'application',
    action: 'application.apk.update',
    resourceType: 'application',
    resourceId: id,
    resourceLabel: command.name,
    details: { uploadedApkId }
  })
  revalidateApplicationDetail(id)
  const app = await orchestratorAppCatalogClient.getApplication(id)
  return sanitizeAndroidApplicationForUser(app, user)
}
