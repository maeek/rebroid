import { randomUUID } from 'node:crypto'
import 'server-only'
import { decryptMfaSecret, hashRecoveryCode, verifyTotp } from './mfa-crypto'
import { hashPassword, passwordHashNeedsUpgrade, verifyPassword } from './password-hashing'
import { toPublicUser } from './user-model'
import { mutateUsersFile, readUsersFile } from './user-store'

const dummyPasswordHash = hashPassword(randomUUID())

export const listUsers = async () => {
  const file = await readUsersFile()
  return file.users.map(user => toPublicUser(file, user))
}

export const listGroups = async () => (await readUsersFile()).groups

export const getUserById = async (id: string) => {
  const file = await readUsersFile()
  const user = file.users.find(item => item.id === id)
  return user ? toPublicUser(file, user) : null
}

export const authenticate = async (username: string, password: string, mfaCode?: string) => {
  const file = await readUsersFile()
  const normalizedUsername = username.trim().toLocaleLowerCase('en-US')
  const user = file.users.find(item => item.username.toLocaleLowerCase('en-US') === normalizedUsername)
  const passwordMatches = await verifyPassword(password, user?.passwordHash ?? (await dummyPasswordHash))
  if (!user || user.disabled || !passwordMatches) {
    return null
  }
  if (user.mfaSecretEncrypted) {
    const code = mfaCode?.trim() ?? ''
    const totpValid = verifyTotp(decryptMfaSecret(user.mfaSecretEncrypted), code)
    const recoveryHash = hashRecoveryCode(user.id, code)
    const recoveryIndex = user.mfaRecoveryCodeHashes.indexOf(recoveryHash)
    if (!totpValid && recoveryIndex < 0) return null
    if (recoveryIndex >= 0) {
      await mutateUsersFile(current => {
        const currentUser = current.users.find(item => item.id === user.id)
        const currentIndex = currentUser?.mfaRecoveryCodeHashes.indexOf(recoveryHash) ?? -1
        if (!currentUser || currentIndex < 0) return
        currentUser.mfaRecoveryCodeHashes.splice(currentIndex, 1)
      })
    }
  }
  if (passwordHashNeedsUpgrade(user.passwordHash)) {
    const upgradedHash = await hashPassword(password)
    await mutateUsersFile(current => {
      const currentUser = current.users.find(item => item.id === user.id)
      if (currentUser?.passwordHash === user.passwordHash) currentUser.passwordHash = upgradedHash
    })
  }
  return {
    id: user.id,
    name: user.name,
    email: null,
    image: user.avatarDataUrl,
    accentColor: user.accentColor,
    role: user.role,
    passwordChangeRequired: user.passwordChangeRequired,
    sessionVersion: user.sessionVersion
  }
}
