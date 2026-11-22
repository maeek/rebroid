import { z } from 'zod'
import { revalidateAppIconPaths } from '@/server/app-icons/shared'
import { maxAppIconRequestBytes, setInitialStoredAppIcon } from '@/server/app-icons/store'
import { PublicActionError } from '@/server/errors/public-action-error'
import { runRouteHandler } from '@/server/http/route-handler'
import { parseBoundedRouteJson } from '@/server/http/route-input'
import { getOwnedApplicationAction } from '@/server/orchestrator/applications/actions/queries/get-application-action'
import { isApplicationId } from '@/shared/model/application-id'

const iconInput = z.object({ icon: z.string().min(1) }).strict()

export const PATCH = (request: Request, context: { params: Promise<{ id: string }> }) =>
  runRouteHandler(async () => {
    const { id } = await context.params
    if (!isApplicationId(id)) throw new PublicActionError('Invalid app ID.', { code: 'validation', status: 400 })
    await getOwnedApplicationAction(id)
    const input = await parseBoundedRouteJson(request, iconInput, {
      maxBytes: maxAppIconRequestBytes,
      tooLargeMessage: 'The app icon is too large.',
      invalidMessage: 'An app icon is required.'
    })
    const icon = await setInitialStoredAppIcon(id, input.icon)
    if (icon) revalidateAppIconPaths(id)
    return icon
  })
