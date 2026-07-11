import 'server-only'
import { PublicActionError } from '@/server/errors/public-action-error'
import { deleteMfaSetup, getMfaSetup, saveMfaSetup } from '@/server/persistence/mfa-setup-repository'
import {
  createMfaSecret,
  createRecoveryCodes,
  decryptMfaSecret,
  encryptMfaSecret,
  hashRecoveryCode,
  verifyTotp
} from './mfa-crypto'
import { verifyPassword } from './password-hashing'
import { nowIso } from './user-model'
import { mutateUsersFile, readUsersFile } from './user-store'

const invalidCredentials = () =>
  new PublicActionError('Current password or authentication code is incorrect.', { code: 'validation', status: 422 })

const beginMfaSetup = async (userId: string, currentPassword: string) => {
  const user = (await readUsersFile()).users.find(item => item.id === userId)
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) throw invalidCredentials()
  if (user.mfaSecretEncrypted) {
    throw new PublicActionError('Multi-factor authentication is already enabled.', { code: 'conflict', status: 409 })
  }

  const secret = createMfaSecret()
  saveMfaSetup(user.id, encryptMfaSecret(secret))
  const label = encodeURIComponent(`Rebroid:${user.username}`)
  const issuer = encodeURIComponent('Rebroid')
  return { secret, otpauthUri: `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&digits=6&period=30` }
}

const confirmMfaSetup = async (userId: string, code: string) => {
  const encryptedSecret = getMfaSetup(userId)
  if (!encryptedSecret || !verifyTotp(decryptMfaSecret(encryptedSecret), code)) {
    throw new PublicActionError('Authentication code is incorrect or setup expired.', {
      code: 'validation',
      status: 422
    })
  }
  const recoveryCodes = createRecoveryCodes()
  await mutateUsersFile(file => {
    const user = file.users.find(item => item.id === userId)
    if (!user) throw invalidCredentials()
    user.mfaSecretEncrypted = encryptedSecret
    user.mfaRecoveryCodeHashes = recoveryCodes.map(recoveryCode => hashRecoveryCode(user.id, recoveryCode))
    user.sessionVersion += 1
    user.updatedAt = nowIso()
  })
  deleteMfaSetup(userId)
  return { recoveryCodes }
}

const disableMfa = async (userId: string, currentPassword: string, code: string) =>
  mutateUsersFile(async file => {
    const user = file.users.find(item => item.id === userId)
    if (!user || !(await verifyPassword(currentPassword, user.passwordHash)) || !user.mfaSecretEncrypted) {
      throw invalidCredentials()
    }
    const totpValid = verifyTotp(decryptMfaSecret(user.mfaSecretEncrypted), code)
    const recoveryHash = hashRecoveryCode(user.id, code)
    if (!totpValid && !user.mfaRecoveryCodeHashes.includes(recoveryHash)) throw invalidCredentials()
    user.mfaSecretEncrypted = null
    user.mfaRecoveryCodeHashes = []
    user.sessionVersion += 1
    user.updatedAt = nowIso()
  })

export const userMfaService = { beginMfaSetup, confirmMfaSetup, disableMfa }
