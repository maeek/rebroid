const viewerTokenParamName = 'sma_viewer_token'
const tokenTtlMs = 30 * 60 * 1000

type ViewerTokenPayload = {
  appId: string
  udid: string
  exp: number
}

const tokenSecret = () => process.env.SCRCPY_VIEWER_TOKEN_SECRET || process.env.NEXTAUTH_SECRET || ''

const base64UrlEncode = (value: string) => btoa(value).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')

const base64UrlDecode = (value: string) => {
  const padded = value
    .replaceAll('-', '+')
    .replaceAll('_', '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=')
  return atob(padded)
}

const sign = async (value: string) => {
  const secret = tokenSecret()
  if (!secret) {
    throw new Error('SCRCPY_VIEWER_TOKEN_SECRET or NEXTAUTH_SECRET must be configured.')
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  const binary = String.fromCharCode(...new Uint8Array(signature))
  return base64UrlEncode(binary)
}

export const createScrcpyViewerToken = async ({ appId, udid }: { appId: string; udid: string }) => {
  const payload: ViewerTokenPayload = {
    appId,
    udid,
    exp: Date.now() + tokenTtlMs
  }
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  return `${encodedPayload}.${await sign(encodedPayload)}`
}

export const verifyScrcpyViewerToken = async ({
  token,
  appId,
  udid
}: {
  token: string | null
  appId: string | null
  udid: string | null
}) => {
  if (!token || !appId || !udid) {
    return false
  }

  const [encodedPayload, providedSignature] = token.split('.')
  if (!encodedPayload || !providedSignature) {
    return false
  }

  const expectedSignature = await sign(encodedPayload)
  if (expectedSignature !== providedSignature) {
    return false
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload)) as Partial<ViewerTokenPayload>
  return payload.appId === appId && payload.udid === udid && typeof payload.exp === 'number' && payload.exp > Date.now()
}

export { viewerTokenParamName }
