import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { WebSettings } from './types'

export const defaultWebSettings: WebSettings = {
  appListRefreshIntervalSeconds: 5,
  removeDataOnDelete: true,
  defaultViewerPreset: 'balanced',
  defaultViewerBitrateMbps: 3,
  defaultViewerMaxFps: 30,
  defaultViewerMaxSize: 1080,
  defaultViewerIFrameInterval: 1,
  defaultViewerKeyboardCaptureEnabled: false,
  defaultViewerSoundEnabled: true
}

const settingsPath = () => process.env.WEB_SETTINGS_PATH || join(process.cwd(), 'data', 'web-settings.json')

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
    value.defaultViewerPreset === 'bandwidth' ||
    value.defaultViewerPreset === 'balanced' ||
    value.defaultViewerPreset === 'quality'
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
      : defaultWebSettings.defaultViewerSoundEnabled
})

export const getWebSettings = async () => {
  try {
    const content = await readFile(settingsPath(), 'utf-8')
    return normalize(JSON.parse(content) as Partial<WebSettings>)
  } catch {
    return defaultWebSettings
  }
}

export const saveWebSettings = async (settings: Partial<WebSettings>) => {
  const current = await getWebSettings()
  const normalized = normalize({ ...current, ...settings })
  const path = settingsPath()
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(normalized, null, 2)}\n`, { encoding: 'utf-8', mode: 0o600 })
  return normalized
}

export const resetWebSettings = async () => {
  const path = settingsPath()
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(defaultWebSettings, null, 2)}\n`, { encoding: 'utf-8', mode: 0o600 })
  return defaultWebSettings
}
