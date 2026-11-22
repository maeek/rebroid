import { z } from 'zod'
import { runRouteHandler } from '@/server/http/route-handler'
import { parseRouteInput, readRouteJson } from '@/server/http/route-input'
import { clearGappsCache, gappsAndroidVersionSchema } from '@/server/platform/image-build-service'

const clearCacheSchema = z.object({ androidVersion: gappsAndroidVersionSchema })

export const DELETE = (request: Request) =>
  runRouteHandler(async () => {
    const { androidVersion } = parseRouteInput(
      clearCacheSchema,
      await readRouteJson(request),
      'Choose an Android version.'
    )
    return clearGappsCache(androidVersion)
  })
