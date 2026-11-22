import { z } from 'zod'
import { runRouteHandler } from '@/server/http/route-handler'
import { parseRouteInput, readRouteJson } from '@/server/http/route-input'
import { gappsAndroidVersionSchema, startGappsBuild } from '@/server/platform/image-build-service'

const startBuildSchema = z.object({
  androidVersion: gappsAndroidVersionSchema,
  targetImage: z.string().trim().min(1).max(512)
})

export const POST = (request: Request) =>
  runRouteHandler(async () =>
    startGappsBuild(
      parseRouteInput(startBuildSchema, await readRouteJson(request), 'Choose an Android version and target image.')
    )
  )
