import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

export type StoredRecentApp = {
  id: string
  openedAt: number
}

type RecentAppsFile = {
  users: Record<string, StoredRecentApp[]>
}

const maxRecentApps = 3
const recentAppsPath = () => process.env.WEB_RECENT_APPS_PATH || join(process.cwd(), 'data', 'recent-apps.json')

const readRecentAppsFile = async (): Promise<RecentAppsFile> => {
  try {
    const parsed = JSON.parse(await readFile(recentAppsPath(), 'utf-8')) as Partial<RecentAppsFile>
    return { users: parsed.users && typeof parsed.users === 'object' ? parsed.users : {} }
  } catch {
    return { users: {} }
  }
}

const writeRecentAppsFile = async (file: RecentAppsFile) => {
  const path = recentAppsPath()
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(file, null, 2)}\n`, 'utf-8')
}

const sanitizeRecentApps = (apps: StoredRecentApp[]) =>
  apps
    .filter(app => app.id && Number.isFinite(app.openedAt))
    .toSorted((left, right) => right.openedAt - left.openedAt)
    .slice(0, maxRecentApps)

export const listStoredRecentApps = async (userId: string) => {
  const file = await readRecentAppsFile()
  return sanitizeRecentApps(file.users[userId] ?? [])
}

export const rememberStoredRecentApp = async (userId: string, appId: string) => {
  const file = await readRecentAppsFile()
  file.users[userId] = sanitizeRecentApps([
    { id: appId, openedAt: Date.now() },
    ...(file.users[userId] ?? []).filter(app => app.id !== appId)
  ])
  await writeRecentAppsFile(file)
  return file.users[userId]
}

export const forgetStoredRecentApp = async (userId: string, appId: string) => {
  const file = await readRecentAppsFile()
  file.users[userId] = sanitizeRecentApps((file.users[userId] ?? []).filter(app => app.id !== appId))
  await writeRecentAppsFile(file)
  return file.users[userId]
}
