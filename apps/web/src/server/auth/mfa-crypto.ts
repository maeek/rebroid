import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import 'server-only'

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

const encryptionKey = () => {
  const configured = process.env.MFA_ENCRYPTION_KEY
  if (!configured || configured.length < 32) {
    throw new Error('MFA_ENCRYPTION_KEY must be configured with at least 32 random characters.')
  }
  return createHash('sha256').update(configured).digest()
}

const encodeBase32 = (input: Buffer) => {
  let bits = ''
  for (const byte of input) bits += byte.toString(2).padStart(8, '0')
  let output = ''
  for (let offset = 0; offset < bits.length; offset += 5) {
    output += alphabet[Number.parseInt(bits.slice(offset, offset + 5).padEnd(5, '0'), 2)]
  }
  return output
}

const decodeBase32 = (input: string) => {
  let bits = ''
  for (const character of input.toUpperCase().replaceAll(/[^A-Z2-7]/g, '')) {
    const index = alphabet.indexOf(character)
    if (index < 0) throw new Error('Invalid MFA secret.')
    bits += index.toString(2).padStart(5, '0')
  }
  const bytes: number[] = []
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2))
  }
  return Buffer.from(bytes)
}

export const createMfaSecret = () => encodeBase32(randomBytes(20))

export const encryptMfaSecret = (secret: string) => {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), ciphertext].map(value => value.toString('base64url')).join('.')
}

export const decryptMfaSecret = (encrypted: string) => {
  const [ivText, tagText, ciphertextText] = encrypted.split('.')
  if (!ivText || !tagText || !ciphertextText) throw new Error('Invalid encrypted MFA secret.')
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivText, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(ciphertextText, 'base64url')), decipher.final()]).toString('utf8')
}

const totpAt = (secret: string, counter: number) => {
  const value = Buffer.alloc(8)
  value.writeBigUInt64BE(BigInt(counter))
  const digest = createHmac('sha1', decodeBase32(secret)).update(value).digest()
  const offset = digest[digest.length - 1] & 0x0f
  const binary = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000
  return String(binary).padStart(6, '0')
}

export const verifyTotp = (secret: string, code: string, now = Date.now()) => {
  const normalized = code.replaceAll(/\s/g, '')
  if (!/^\d{6}$/.test(normalized)) return false
  const provided = Buffer.from(normalized)
  const counter = Math.floor(now / 30_000)
  return [-1, 0, 1].some(offset => timingSafeEqual(Buffer.from(totpAt(secret, counter + offset)), provided))
}

export const createRecoveryCodes = () =>
  Array.from({ length: 10 }, () => `${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}`)

export const hashRecoveryCode = (userId: string, code: string) =>
  createHash('sha256').update(`${userId}:${code.trim().toLowerCase()}`).digest('hex')
