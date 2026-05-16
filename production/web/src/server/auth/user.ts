import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import bcrypt from 'bcrypt'

export type UserRole = 'admin' | 'user'

export type PublicUser = {
  id: string
  username: string
  name: string
  email: string | null
  role: UserRole
  disabled: boolean
  createdAt: string
  updatedAt: string
}

type StoredUser = PublicUser & {
  passwordHash: string
}

type UsersFile = {
  users: StoredUser[]
}

const bcryptRounds = 12
const usersPath = () => process.env.WEB_USERS_PATH || join(process.cwd(), 'data', 'users.json')

const toPublicUser = ({ passwordHash: _passwordHash, ...user }: StoredUser): PublicUser => user

const hashPassword = async (password: string) => {
  return bcrypt.hash(password, bcryptRounds)
}

const verifyPassword = async (password: string, passwordHash: string) => {
  if (!passwordHash.startsWith('$2')) {
    return false
  }

  return bcrypt.compare(password, passwordHash)
}

const defaultAdminUser = async (): Promise<StoredUser> => {
  const now = new Date().toISOString()
  return {
    id: 'admin',
    username: 'admin',
    name: 'Admin',
    email: 'admin@example.com',
    role: 'admin',
    disabled: false,
    passwordHash: await hashPassword(process.env.INITIAL_ADMIN_PASSWORD || 'admin'),
    createdAt: now,
    updatedAt: now
  }
}

const readUsersFile = async (): Promise<UsersFile> => {
  try {
    return JSON.parse(await readFile(usersPath(), 'utf-8')) as UsersFile
  } catch {
    const initial = { users: [await defaultAdminUser()] }
    await writeUsersFile(initial)
    return initial
  }
}

const writeUsersFile = async (file: UsersFile) => {
  const path = usersPath()
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(file, null, 2)}\n`, 'utf-8')
}

const listUsers = async () => {
  const file = await readUsersFile()
  return file.users.map(toPublicUser)
}

const authenticate = async (username: string, password: string) => {
  const file = await readUsersFile()
  const user = file.users.find(item => item.username === username)
  if (!user || user.disabled || !(await verifyPassword(password, user.passwordHash))) {
    return null
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: null,
    role: user.role
  }
}

const createUser = async ({
  username,
  password,
  role = 'user'
}: {
  username: string
  password: string
  role?: UserRole
}) => {
  const file = await readUsersFile()
  const normalizedUsername = username.trim()
  if (!normalizedUsername || password.length < 8) {
    throw new Error('Username is required and password must be at least 8 characters.')
  }
  if (file.users.some(user => user.username === normalizedUsername)) {
    throw new Error('Username already exists.')
  }

  const now = new Date().toISOString()
  const user: StoredUser = {
    id: randomUUID(),
    username: normalizedUsername,
    name: normalizedUsername,
    email: null,
    role,
    disabled: false,
    passwordHash: await hashPassword(password),
    createdAt: now,
    updatedAt: now
  }
  file.users.push(user)
  await writeUsersFile(file)
  return toPublicUser(user)
}

const setUserDisabled = async (id: string, disabled: boolean) => {
  const file = await readUsersFile()
  const user = file.users.find(item => item.id === id)
  if (!user) {
    throw new Error('User not found.')
  }
  if (
    user.role === 'admin' &&
    disabled &&
    file.users.filter(item => item.role === 'admin' && !item.disabled).length < 2
  ) {
    throw new Error('Cannot disable the last active admin.')
  }

  user.disabled = disabled
  user.updatedAt = new Date().toISOString()
  await writeUsersFile(file)
  return toPublicUser(user)
}

const resetPassword = async (id: string, password: string) => {
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters.')
  }

  const file = await readUsersFile()
  const user = file.users.find(item => item.id === id)
  if (!user) {
    throw new Error('User not found.')
  }

  user.passwordHash = await hashPassword(password)
  user.updatedAt = new Date().toISOString()
  await writeUsersFile(file)
  return toPublicUser(user)
}

const deleteUser = async (id: string) => {
  const file = await readUsersFile()
  const user = file.users.find(item => item.id === id)
  if (!user) {
    throw new Error('User not found.')
  }
  if (user.role === 'admin' && file.users.filter(item => item.role === 'admin' && !item.disabled).length < 2) {
    throw new Error('Cannot delete the last active admin.')
  }

  file.users = file.users.filter(item => item.id !== id)
  await writeUsersFile(file)
  return toPublicUser(user)
}

export const userService = {
  authenticate,
  createUser,
  deleteUser,
  listUsers,
  resetPassword,
  setUserDisabled
}
