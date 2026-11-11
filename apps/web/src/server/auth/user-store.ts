import { readUsersFileFromDatabase, writeUsersFileToDatabase } from '@/server/persistence/users-repository'
import { revokeViewerSessionsForUsers } from '@/server/users/revoke-viewer-sessions'
import { createViewerRevocationJob, finishViewerRevocation } from '@/server/users/viewer-revocation-job'
import { administratorsGroupId } from '@/shared/permissions/effective-access'
import { hashPassword } from './password-hashing'
import { assertAdministratorForMutation } from './user-admin-guard'
import { defaultGroups, nowIso } from './user-model'
import type { AccountSessionIdentity } from './session-identity'
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

export type AdministratorMutation = {
  identity: AccountSessionIdentity
  requestId: string
}

const enqueueUsersMutation = <Result>(mutation: (file: UsersFile) => Promise<Result>) => {
  const pending = usersMutationQueue.then(async () => mutation(await readUsersFile()))
  usersMutationQueue = pending.then(
    () => undefined,
    () => undefined
  )
  return pending
}

export const mutateUsersFile = async <Result>(
  mutation: (file: UsersFile) => Promise<Result> | Result,
  revokeViewerFor?: string
) => {
  const revocation = revokeViewerFor ? createViewerRevocationJob([revokeViewerFor]) : undefined
  const result = await enqueueUsersMutation(async file => {
    const value = await mutation(file)
    writeUsersFileToDatabase(file, revocation)
    return value
  })
  if (revocation) await finishViewerRevocation(revocation)
  return result
}

type AdministratorMutationResult<Value> = {
  value: Value
  affectedOwners?: readonly string[]
}

export const mutateAdministratorUsersFile = async <Value>(
  { identity, requestId }: AdministratorMutation,
  mutation: (file: UsersFile) => AdministratorMutationResult<Value> | Promise<AdministratorMutationResult<Value>>
) => {
  const committed = await enqueueUsersMutation(async file => {
    assertAdministratorForMutation(file, identity)
    const { value, affectedOwners } = await mutation(file)
    let revocation: ViewerRevocationJob | undefined
    if (affectedOwners?.length) {
      await revokeViewerSessionsForUsers(affectedOwners, AbortSignal.timeout(20_000))
      revocation = createViewerRevocationJob(affectedOwners, requestId)
    }
    writeUsersFileToDatabase(file, revocation)
    return { value, revocation }
  })
  const complete = !committed.revocation || (await finishViewerRevocation(committed.revocation))
  return { value: committed.value, viewerRevocation: complete ? ('complete' as const) : ('pending' as const) }
}
