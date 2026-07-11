import { z } from 'zod'
import { runRouteHandler } from '@/server/http/route-handler'
import { clearGappsCache } from '@/server/platform/image-build-service'

const clearCacheSchema = z.object({ androidVersion: z.enum(['13', '14']) })

export const DELETE = (request: Request) =>
  runRouteHandler(async () => {
    const { androidVersion } = clearCacheSchema.parse(await request.json())
    return clearGappsCache(androidVersion)
  })
