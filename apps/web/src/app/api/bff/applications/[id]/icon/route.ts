import { z } from 'zod'
import { revalidateAppIconPaths } from '@/server/app-icons/shared'
import { maxAppIconRequestBytes, setInitialStoredAppIcon } from '@/server/app-icons/store'
import { PublicActionError } from '@/server/errors/public-action-error'
import { runRouteHandler } from '@/server/http/route-handler'
import { getOwnedApplicationAction } from '@/server/orchestrator/applications/actions/queries/get-application-action'
import { enforceStreamingLimit, StreamingUploadTooLargeError } from '@/server/upload-proxy/streaming-upload'
import { isApplicationId } from '@/shared/model/application-id'

const iconInput = z.object({ icon: z.string().min(1) }).strict()

export const PATCH = (request: Request, context: { params: Promise<{ id: string }> }) =>
  runRouteHandler(async () => {
    const { id } = await context.params
    if (!isApplicationId(id)) throw new PublicActionError('Invalid app ID.', { code: 'validation', status: 400 })
    await getOwnedApplicationAction(id)
    const bytes =
      request.body && enforceStreamingLimit(request.body, maxAppIconRequestBytes, 'The app icon is too large.')
    const payload: unknown = await new Response(bytes).json().catch((error: unknown) => {
      if (error instanceof StreamingUploadTooLargeError) {
        throw new PublicActionError(error.message, { code: 'validation', status: 413 })
      }
      throw new PublicActionError('An app icon is required.', { code: 'validation', status: 400 })
    })
    const input = iconInput.safeParse(payload)
    if (!input.success) {
      throw new PublicActionError('An app icon is required.', { code: 'validation', status: 400 })
    }
    const icon = await setInitialStoredAppIcon(id, input.data.icon)
    if (icon) revalidateAppIconPaths(id)
    return icon
  })
