import { readWebState, writeWebState } from '@/server/storage/database'
import { hashPassword } from './password-hashing'
import { normalizeGroups, normalizeUser, nowIso } from './user-model'
import type { StoredUser, UsersFile } from './user-model'

const usersStateKey = 'users'
let usersMutationQueue = Promise.resolve()

const defaultAdminUser = async (): Promise<StoredUser> => {
  const initialPassword = process.env.INITIAL_ADMIN_PASSWORD
  if (!initialPassword) {
    throw new Error('INITIAL_ADMIN_PASSWORD is required when creating the first administrator.')
  }

  const now = nowIso()
  return {
    id: 'admin',
    username: 'admin',
    name: 'Admin',
    role: 'admin',
    groupIds: ['admins'],
    disabled: false,
    passwordChangeRequired: false,
    sessionVersion: 1,
    avatarDataUrl: null,
    accentColor: 'blue',
    permissionOverrides: {},
    quotas: {},
    passwordHash: await hashPassword(initialPassword),
    createdAt: now,
    updatedAt: now
  }
}

const normalizeUsersFile = async (input: Partial<UsersFile>): Promise<UsersFile> => {
  const normalizedGroups = normalizeGroups(input.groups)
  const users =
    input.users && input.users.length > 0 ? input.users.map(user => normalizeUser(user)) : [await defaultAdminUser()]

  return { groups: normalizedGroups, users }
}

export const readUsersFile = async (): Promise<UsersFile> => {
  const stored = readWebState(usersStateKey)
  if (stored !== null) {
    return normalizeUsersFile(parseUsersFile(stored))
  }

  const initial = await normalizeUsersFile({})
  await writeUsersFile(initial)
  return initial
}

const writeUsersFile = (file: UsersFile) => {
  return Promise.resolve(writeWebState(usersStateKey, JSON.stringify(file)))
}

const parseUsersFile = (content: string): Partial<UsersFile> => {
  const parsed = JSON.parse(content) as Partial<UsersFile>
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.users) || !Array.isArray(parsed.groups)) {
    throw new Error(
      'The users store is malformed. Restore it from backup or repair it before starting the web service.'
    )
  }

  return parsed
}

export const mutateUsersFile = async <Result>(mutation: (file: UsersFile) => Promise<Result> | Result) => {
  const pending = usersMutationQueue.then(async () => {
    const file = await readUsersFile()
    const result = await mutation(file)
    await writeUsersFile(file)
    return result
  })
  usersMutationQueue = pending.then(
    () => undefined,
    () => undefined
  )
  return pending
}
