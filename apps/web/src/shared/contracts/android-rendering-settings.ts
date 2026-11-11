import {
  androidRenderingModes,
  isDrmRenderDevice,
  type AndroidRenderingSettings
} from '@rebroid/android-application-core/redroid-runtime'
import { z } from 'zod'

export const renderDeviceError = 'Enter a DRM render device such as /dev/dri/renderD128.'

export const androidRenderingSettingsSchema = z
  .strictObject({
    mode: z.enum(androidRenderingModes),
    renderDevice: z.string().nullable()
  })
  .refine(
    ({ mode, renderDevice }) => (mode === 'software' && renderDevice === null) || isDrmRenderDevice(renderDevice),
    { path: ['renderDevice'], message: renderDeviceError }
  ) satisfies z.ZodType<AndroidRenderingSettings>
