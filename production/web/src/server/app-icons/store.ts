import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const safeId = (appId: string) => appId.replace(/[^a-zA-Z0-9_-]/g, '')
const iconPath = (appId: string) =>
  join(process.env.WEB_APP_ICONS_PATH || join(process.cwd(), 'data', 'app-icons'), `${safeId(appId)}.json`)

export const getStoredAppIcon = async (appId: string) => {
  try {
    const content = await readFile(iconPath(appId), 'utf-8')
    const parsed = JSON.parse(content) as { icon?: unknown }
    return typeof parsed.icon === 'string' ? parsed.icon : null
  } catch {
    return null
  }
}

export const setStoredAppIcon = async (appId: string, icon: string) => {
  const path = iconPath(appId)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify({ icon }, null, 2)}\n`, 'utf-8')
  return icon
}

export const removeStoredAppIcon = async (appId: string) => {
  await unlink(iconPath(appId)).catch(() => undefined)
}
