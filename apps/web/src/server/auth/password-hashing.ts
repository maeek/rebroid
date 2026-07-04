import bcrypt from 'bcrypt'

const bcryptRounds = 12

export const hashPassword = async (password: string) => bcrypt.hash(password, bcryptRounds)

export const verifyPassword = async (password: string, passwordHash: string) => {
  if (!passwordHash.startsWith('$2')) {
    return false
  }

  return bcrypt.compare(password, passwordHash)
}
