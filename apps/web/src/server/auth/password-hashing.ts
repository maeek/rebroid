import argon2 from 'argon2'
import bcrypt from 'bcrypt'

const argon2Options = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1
} as const

export const hashPassword = async (password: string) => argon2.hash(password, argon2Options)

export const verifyPassword = async (password: string, passwordHash: string) => {
  try {
    if (passwordHash.startsWith('$argon2id$')) {
      return await argon2.verify(passwordHash, password)
    }
    if (passwordHash.startsWith('$2')) {
      return await bcrypt.compare(password, passwordHash)
    }
  } catch {
    return false
  }
  return false
}

export const passwordHashNeedsUpgrade = (passwordHash: string) => !passwordHash.startsWith('$argon2id$')
