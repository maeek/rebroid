import { unstable_rethrow } from 'next/navigation'
import { mapAndroidApplicationToAppDefinition } from '@/features/applications/domain/app-mapper'
import { withStoredAppIcon } from '@/features/applications/icons/enrich'
import { PublicActionError } from '@/server/errors/public-action-error'
import { logger } from '@/server/observability/logger'
import { getRequestId, normalizeRequestId } from '@/server/observability/request-id'
import { getApplicationAction } from '@/server/orchestrator/applications/actions/queries/get-application-action'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { getServerOrchestratorUiSettings } from '@/server/orchestrator/get-server-ui-settings'
import { OrchestratorRequestError } from '@/server/orchestrator/request'
import { getOwnerDisplayName, getVisibleOwnerDisplayNames } from '@/server/users/owner-display-names'
import { isApplicationId } from '@/shared/model/application-id'
import type { AppPageFailureState } from '@/features/applications/components/app-page-failure'

const loadApplication = async (id: string) => {
  try {
    return { app: mapAndroidApplicationToAppDefinition(await getApplicationAction(id)) }
  } catch (error) {
    unstable_rethrow(error)
    const status =
      error instanceof PublicActionError || error instanceof OrchestratorRequestError ? error.status : undefined
    if (status === 404 || status === 403) {
      return { failure: { kind: 'not-found' } satisfies AppPageFailureState }
    }
    const upstreamId =
      error instanceof OrchestratorRequestError && error.requestId !== 'unknown'
        ? normalizeRequestId(error.requestId)
        : null
    const requestId = upstreamId ?? (await getRequestId())
    logger.error('application_page.load_failed', {
      requestId,
      errorName: error instanceof Error ? error.name : 'UnknownError',
      errorStatus: status
    })
    return { failure: { kind: 'unavailable', requestId } satisfies AppPageFailureState }
  }
}

export const getApplicationPageData = async (id: string) => {
  const user = await getCurrentUserContext()
  if (!isApplicationId(id)) return { failure: { kind: 'invalid-link' } satisfies AppPageFailureState }
  const result = await loadApplication(id)
  if (result.failure) return { failure: result.failure }

  const [initialSettings, ownerNames] = await Promise.all([
    getServerOrchestratorUiSettings(),
    getVisibleOwnerDisplayNames(user)
  ])
  const app = await withStoredAppIcon({
    ...result.app,
    ownerDisplayName: getOwnerDisplayName(ownerNames, result.app.ownerUserId)
  })
  return {
    data: {
      app,
      initialSettings,
      permissions: user.permissions,
      currentOwnerUserId: user.ownerUserId,
      isAdmin: user.isPlatformAdmin
    }
  }
}
