import { readWebState, updateWebState, writeWebState } from '@/server/storage/database'

type StoredRecentApp = {
  id: string
  openedAt: number
}

type RecentAppsFile = {
  users: Record<string, StoredRecentApp[]>
}

const maxRecentApps = 3
const recentAppsStateKey = 'recent-apps'

const readRecentAppsFile = (): Promise<RecentAppsFile> => {
  const stored = readWebState(recentAppsStateKey)
  if (stored !== null) {
    const parsed = JSON.parse(stored) as Partial<RecentAppsFile>
    return Promise.resolve({ users: parsed.users && typeof parsed.users === 'object' ? parsed.users : {} })
  }

  const initial: RecentAppsFile = { users: {} }
  writeWebState(recentAppsStateKey, JSON.stringify(initial))
  return Promise.resolve(initial)
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
  await readRecentAppsFile()
  return updateWebState(recentAppsStateKey, current => {
    const file = JSON.parse(current ?? '{"users":{}}') as RecentAppsFile
    file.users[userId] = sanitizeRecentApps([
      { id: appId, openedAt: Date.now() },
      ...(file.users[userId] ?? []).filter(app => app.id !== appId)
    ])
    return [JSON.stringify(file), file.users[userId]]
  })
}

export const forgetStoredRecentApp = async (userId: string, appId: string) => {
  await readRecentAppsFile()
  return updateWebState(recentAppsStateKey, current => {
    const file = JSON.parse(current ?? '{"users":{}}') as RecentAppsFile
    file.users[userId] = sanitizeRecentApps((file.users[userId] ?? []).filter(app => app.id !== appId))
    return [JSON.stringify(file), file.users[userId]]
  })
}
