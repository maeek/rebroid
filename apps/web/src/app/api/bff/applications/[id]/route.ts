import { z } from 'zod'
import { runRouteHandler } from '@/server/http/route-handler'
import { getSanitizedAccessibleApplication } from '@/server/orchestrator/applications/actions/common/action-helpers'

export const GET = (_request: Request, context: { params: Promise<{ id: string }> }) =>
  runRouteHandler(async () => {
    const { id } = await context.params
    return getSanitizedAccessibleApplication(z.uuid().parse(id))
  })
