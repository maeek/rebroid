import { runRouteHandler } from '@/server/http/route-handler'
import { readRouteJson } from '@/server/http/route-input'
import {
  readAndroidRenderingSettings,
  saveAndroidRenderingSettings
} from '@/server/platform/android-rendering-settings'

export const GET = () => runRouteHandler(readAndroidRenderingSettings)
export const PATCH = (request: Request) =>
  runRouteHandler(async () => saveAndroidRenderingSettings(await readRouteJson(request)))
