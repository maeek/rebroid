import { z } from 'zod'
import { runRouteHandler } from '@/server/http/route-handler'
import {
  readUiSettings,
  resetGeneralUiSettings,
  resetRuntimeUiSettings,
  saveAiUiSettings,
  saveGeneralUiSettings,
  saveRuntimeUiSettings
} from '@/server/preferences/ui-settings-service'

const generalSettingsSchema = z.object({
  appListRefreshIntervalSeconds: z.number().int().min(2).max(120),
  defaultViewerPreset: z.enum(['low-latency', 'balanced', 'high-quality', 'bandwidth-saver']),
  defaultViewerBitrateMbps: z.number().int().min(1).max(32),
  defaultViewerMaxFps: z.number().int().min(1).max(120),
  defaultViewerMaxSize: z.number().int().min(0).max(4096),
  defaultViewerIFrameInterval: z.number().int().min(1).max(30),
  defaultViewerKeyboardCaptureEnabled: z.boolean(),
  defaultViewerSoundEnabled: z.boolean()
})

const optionalServiceSchema = z.object({
  enabled: z.boolean(),
  endpoint: z.string().trim().min(1).nullable(),
  timeoutMs: z.number().int().positive().max(120_000)
})

const runtimeSettingsSchema = z.object({
  defaultContainerImage: z.string().trim().min(1).max(512),
  dockerImageRegistry: z.string().trim().min(1).max(2048).nullable(),
  defaultInactivityTimeoutSeconds: z.number().int().nonnegative().max(31_536_000),
  maxApkUploadSizeMb: z.number().int().positive().max(4096),
  removeDataOnDelete: z.boolean().optional(),
  services: z.object({
    ocr: optionalServiceSchema.extend({
      maxImageDimension: z.number().int().positive().max(16_384),
      minConfidence: z.number().min(0).max(1),
      languages: z.array(z.string().trim().min(1).max(32)).max(32),
      preprocessingModes: z.array(z.string().trim().min(1).max(64)).max(32)
    }),
    firewall: optionalServiceSchema
  })
})

const updateSchema = z.discriminatedUnion('operation', [
  z.object({ operation: z.literal('save-general'), settings: generalSettingsSchema }),
  z.object({ operation: z.literal('reset-general') }),
  z.object({ operation: z.literal('save-ai'), settings: z.object({ aiContextualSuggestionsEnabled: z.boolean() }) }),
  z.object({ operation: z.literal('save-runtime'), settings: runtimeSettingsSchema }),
  z.object({ operation: z.literal('reset-runtime') })
])

export const GET = () => runRouteHandler(readUiSettings)

export const POST = (request: Request) =>
  runRouteHandler(async () => {
    const input = updateSchema.parse(await request.json())
    if (input.operation === 'save-general') return saveGeneralUiSettings(input.settings)
    if (input.operation === 'reset-general') return resetGeneralUiSettings()
    if (input.operation === 'save-ai') return saveAiUiSettings(input.settings)
    if (input.operation === 'save-runtime') return saveRuntimeUiSettings(input.settings)
    return resetRuntimeUiSettings()
  })
