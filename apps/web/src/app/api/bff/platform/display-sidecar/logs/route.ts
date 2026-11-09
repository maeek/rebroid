import { PublicActionError } from '@/server/errors/public-action-error'
import { runRouteHandler } from '@/server/http/route-handler'
import { getDisplaySidecarLogs } from '@/server/platform/queries'

export const GET = async (request: Request) => {
  const response = await runRouteHandler(() => {
    const values = new URL(request.url).searchParams.getAll('expanded')
    const [expanded = 'false'] = values
    if (values.length > 1 || (expanded !== 'false' && expanded !== 'true')) {
      throw new PublicActionError('Choose the preview or expanded log view.', { code: 'validation', status: 400 })
    }
    return getDisplaySidecarLogs(expanded === 'true')
  })
  response.headers.set('cache-control', 'no-store')
  return response
}
