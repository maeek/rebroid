import { z } from 'zod'
import { runRouteHandler } from '@/server/http/route-handler'
import { clearGappsCache, gappsAndroidVersionSchema } from '@/server/platform/image-build-service'

const clearCacheSchema = z.object({ androidVersion: gappsAndroidVersionSchema })

export const DELETE = (request: Request) =>
  runRouteHandler(async () => {
    const { androidVersion } = clearCacheSchema.parse(await request.json())
    return clearGappsCache(androidVersion)
  })
