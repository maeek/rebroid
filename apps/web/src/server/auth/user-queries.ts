import 'server-only'
import { verifyPassword } from './password-hashing'
import { toPublicUser } from './user-model'
import { readUsersFile } from './user-store'

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

export const authenticate = async (username: string, password: string) => {
  const file = await readUsersFile()
  const user = file.users.find(item => item.username === username)
  if (!user || user.disabled || !(await verifyPassword(password, user.passwordHash))) {
    return null
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
