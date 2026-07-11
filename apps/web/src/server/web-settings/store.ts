import {
  readSettingsDocument,
  updateSettingsDocument,
  writeSettingsDocument
} from '@/server/persistence/settings-repository'
import type { WebSettings } from './types'

const defaultWebSettings: WebSettings = {
  appListRefreshIntervalSeconds: 5,
  removeDataOnDelete: true,
  defaultViewerPreset: 'balanced',
  defaultViewerBitrateMbps: 3,
  defaultViewerMaxFps: 30,
  defaultViewerMaxSize: 1080,
  defaultViewerIFrameInterval: 1,
  defaultViewerKeyboardCaptureEnabled: false,
  defaultViewerSoundEnabled: true,
  aiContextualSuggestionsEnabled: true,
  auditRetentionDays: 30,
  passwordMinimumLength: 12
}

const numberInRange = (value: unknown, fallback: number, minimum: number, maximum: number) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(maximum, Math.max(minimum, Math.trunc(parsed)))
}

const normalize = (value: Partial<WebSettings>): WebSettings => ({
  appListRefreshIntervalSeconds: numberInRange(
    value.appListRefreshIntervalSeconds,
    defaultWebSettings.appListRefreshIntervalSeconds,
    2,
    120
  ),
  removeDataOnDelete:
    typeof value.removeDataOnDelete === 'boolean' ? value.removeDataOnDelete : defaultWebSettings.removeDataOnDelete,
  defaultViewerPreset:
    value.defaultViewerPreset === 'low-latency' ||
    value.defaultViewerPreset === 'balanced' ||
    value.defaultViewerPreset === 'high-quality' ||
    value.defaultViewerPreset === 'bandwidth-saver'
      ? value.defaultViewerPreset
      : defaultWebSettings.defaultViewerPreset,
  defaultViewerBitrateMbps: numberInRange(
    value.defaultViewerBitrateMbps,
    defaultWebSettings.defaultViewerBitrateMbps,
    1,
    32
  ),
  defaultViewerMaxFps: numberInRange(value.defaultViewerMaxFps, defaultWebSettings.defaultViewerMaxFps, 1, 120),
  defaultViewerMaxSize:
    value.defaultViewerMaxSize === 0
      ? 0
      : numberInRange(value.defaultViewerMaxSize, defaultWebSettings.defaultViewerMaxSize, 1080, 4096),
  defaultViewerIFrameInterval: numberInRange(
    value.defaultViewerIFrameInterval,
    defaultWebSettings.defaultViewerIFrameInterval,
    1,
    30
  ),
  defaultViewerKeyboardCaptureEnabled:
    typeof value.defaultViewerKeyboardCaptureEnabled === 'boolean'
      ? value.defaultViewerKeyboardCaptureEnabled
      : defaultWebSettings.defaultViewerKeyboardCaptureEnabled,
  defaultViewerSoundEnabled:
    typeof value.defaultViewerSoundEnabled === 'boolean'
      ? value.defaultViewerSoundEnabled
      : defaultWebSettings.defaultViewerSoundEnabled,
  aiContextualSuggestionsEnabled:
    typeof value.aiContextualSuggestionsEnabled === 'boolean'
      ? value.aiContextualSuggestionsEnabled
      : defaultWebSettings.aiContextualSuggestionsEnabled,
  auditRetentionDays: numberInRange(value.auditRetentionDays, defaultWebSettings.auditRetentionDays, 1, 3650),
  passwordMinimumLength: numberInRange(value.passwordMinimumLength, defaultWebSettings.passwordMinimumLength, 1, 128)
})

export const getWebSettings = () =>
  Promise.resolve().then(() => {
    const stored = readSettingsDocument()
    if (stored !== null) {
      return normalize(stored)
    }

    writeSettingsDocument(defaultWebSettings)
    return { ...defaultWebSettings }
  })

export const saveWebSettings = async (settings: Partial<WebSettings>) => {
  await getWebSettings()
  return updateSettingsDocument<WebSettings>(current => {
    const normalized = normalize({ ...(current as Partial<WebSettings> | null), ...settings })
    return [{ ...normalized }, normalized]
  })
}

export const resetWebSettings = () => {
  writeSettingsDocument(defaultWebSettings)
  return Promise.resolve({ ...defaultWebSettings })
}
