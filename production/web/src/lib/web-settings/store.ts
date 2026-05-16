import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { ORCHESTRATOR_OWNER_USER_ID } from '@/lib/orchestrator/types'

export interface WebSettings {
  ownerUserId: string
  appListRefreshIntervalSeconds: number
  removeDataOnDelete: boolean
}

export const defaultWebSettings: WebSettings = {
  ownerUserId: ORCHESTRATOR_OWNER_USER_ID,
  appListRefreshIntervalSeconds: 5,
  removeDataOnDelete: true
}

const settingsPath = () => process.env.WEB_SETTINGS_PATH || join(process.cwd(), 'data', 'web-settings.json')

const numberInRange = (value: unknown, fallback: number, minimum: number, maximum: number) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(maximum, Math.max(minimum, Math.trunc(parsed)))
}

const normalize = (value: Partial<WebSettings>): WebSettings => ({
  ownerUserId: value.ownerUserId?.trim() || defaultWebSettings.ownerUserId,
  appListRefreshIntervalSeconds: numberInRange(
    value.appListRefreshIntervalSeconds,
    defaultWebSettings.appListRefreshIntervalSeconds,
    2,
    120
  ),
  removeDataOnDelete:
    typeof value.removeDataOnDelete === 'boolean' ? value.removeDataOnDelete : defaultWebSettings.removeDataOnDelete
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
  await writeFile(path, `${JSON.stringify(normalized, null, 2)}\n`, 'utf-8')
  return normalized
}

export const resetWebSettings = async () => {
  const path = settingsPath()
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(defaultWebSettings, null, 2)}\n`, 'utf-8')
  return defaultWebSettings
}
