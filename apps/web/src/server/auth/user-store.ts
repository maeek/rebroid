import { readUsersFileFromDatabase, writeUsersFileToDatabase } from '@/server/persistence/users-repository'
import { administratorsGroupId } from '@/shared/permissions/effective-access'
import { hashPassword } from './password-hashing'
import { defaultGroups, nowIso } from './user-model'
import type { StoredUser, UsersFile } from './user-model'
import type { ViewerRevocationJob } from '@/server/persistence/web-maintenance-repository'

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
    groupIds: [administratorsGroupId],
    disabled: false,
    passwordChangeRequired: true,
    sessionVersion: 1,
    avatarDataUrl: null,
    accentColor: 'blue',
    passwordHash: await hashPassword(initialPassword),
    mfaSecretEncrypted: null,
    mfaRecoveryCodeHashes: [],
    createdAt: now,
    updatedAt: now
  }
}

export const readUsersFile = async (): Promise<UsersFile> => {
  const stored = readUsersFileFromDatabase()
  if (stored !== null) return stored

  const initial = { groups: defaultGroups(), users: [await defaultAdminUser()] }
  const initialized = readUsersFileFromDatabase()
  if (initialized !== null) return initialized
  writeUsersFileToDatabase(initial)
  return initial
}

export type PrepareViewerRevocation = (userIds: readonly string[]) => Promise<ViewerRevocationJob | undefined>

export const mutateUsersFile = async <Result>(
  mutation: (file: UsersFile) => Promise<Result> | Result,
  prepareRevocation?: (file: UsersFile) => Promise<ViewerRevocationJob | undefined>
) => {
  const pending = usersMutationQueue.then(async () => {
    const file = await readUsersFile()
    const revocation = await prepareRevocation?.(file)
    const result = await mutation(file)
    writeUsersFileToDatabase(file, revocation)
    return result
  })
  usersMutationQueue = pending.then(
    () => undefined,
    () => undefined
  )
  return pending
}
