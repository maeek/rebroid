/* eslint-disable no-console */
import { spawn } from 'node:child_process'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { readFileSync } from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'

const publicPort = Number(process.env.PORT || 3443)
const nextPort = Number(process.env.NEXT_INTERNAL_PORT || 3101)
const nextHost = process.env.NEXT_INTERNAL_HOST || '127.0.0.1'
const sidecarBaseUrl = new URL(
  process.env.DISPLAY_SIDECAR_INTERNAL_BASE_URL ||
    process.env.WS_SCRCPY_INTERNAL_BASE_URL ||
    'http://rebroid-display-sidecar:8000'
)
const tlsCertFile = process.env.REBROID_TLS_CERT_FILE || '/app/data/certificates/rebroid-web.crt'
const tlsKeyFile = process.env.REBROID_TLS_KEY_FILE || '/app/data/certificates/rebroid-web.key'
const viewerTokenCookieName = 'rebroid_viewer_token'
const viewerPathPrefix = '/viewer/ws-scrcpy'
const displayViewerPathPrefix = '/viewer/display'
const displayPathPrefix = '/rebroid/display'
const defaultNextAuthUrl = process.env.NEXTAUTH_URL || process.env.AUTH_URL || `https://localhost:${publicPort}`

const nextProcess = spawn(process.execPath, ['server.js'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT: String(nextPort),
    HOSTNAME: nextHost,
    NEXTAUTH_URL: defaultNextAuthUrl,
    AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST || 'true'
  }
})

nextProcess.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 1)
})

const base64UrlDecode = value => {
  const padded = value
    .replaceAll('-', '+')
    .replaceAll('_', '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=')
  return Buffer.from(padded, 'base64').toString('utf8')
}

const tokenSecret = () => process.env.SCRCPY_VIEWER_TOKEN_SECRET || process.env.NEXTAUTH_SECRET || ''

const sign = value => createHmac('sha256', tokenSecret()).update(value).digest('base64url')

const parseCookies = (cookieHeader = '') =>
  Object.fromEntries(
    cookieHeader
      .split(';')
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        const separatorIndex = part.indexOf('=')
        if (separatorIndex === -1) {
          return [part, '']
        }

        return [part.slice(0, separatorIndex), decodeURIComponent(part.slice(separatorIndex + 1))]
      })
  )

const parseTokenPayload = encodedPayload => {
  try {
    return JSON.parse(base64UrlDecode(encodedPayload))
  } catch {
    return null
  }
}

const signaturesMatch = (expected, provided) => {
  const expectedBuffer = Buffer.from(expected)
  const providedBuffer = Buffer.from(provided)
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer)
}

const verifyViewerToken = ({ token, appId, udid, requireIdentity }) => {
  if (!token || !tokenSecret()) {
    return false
  }

  const [encodedPayload, providedSignature] = token.split('.')
  if (!encodedPayload || !providedSignature) {
    return false
  }

  if (!signaturesMatch(sign(encodedPayload), providedSignature)) {
    return false
  }

  const payload = parseTokenPayload(encodedPayload)
  if (!payload || typeof payload.exp !== 'number' || payload.exp <= Date.now()) {
    return false
  }

  if (!requireIdentity) {
    return true
  }

  return payload.appId === appId && payload.udid === udid
}

const isViewerRequestAuthorized = (requestUrl, req) => {
  const action = requestUrl.searchParams.get('action')
  const allowedActions = new Set(['proxy-adb', 'proxy-scrcpy-v4'])
  if (action && !allowedActions.has(action)) {
    return false
  }

  const queryToken = requestUrl.searchParams.get(viewerTokenCookieName)
  if (queryToken) {
    return verifyViewerToken({
      token: queryToken,
      appId: requestUrl.searchParams.get('appId'),
      udid: requestUrl.searchParams.get('udid'),
      requireIdentity: true
    })
  }

  const cookieToken = parseCookies(req.headers.cookie)[viewerTokenCookieName]
  return verifyViewerToken({
    token: cookieToken,
    appId: null,
    udid: null,
    requireIdentity: false
  })
}

const targetForRequest = req => {
  const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  if (requestUrl.pathname.startsWith(viewerPathPrefix)) {
    const action = requestUrl.searchParams.get('action')
    const sidecarAssetPath = requestUrl.pathname.slice(viewerPathPrefix.length) || '/'
    const sidecarPath = action
      ? `${requestUrl.pathname}${requestUrl.search}`
      : `${sidecarAssetPath}${requestUrl.search}`

    return {
      kind: 'sidecar',
      baseUrl: sidecarBaseUrl,
      path: sidecarPath,
      requestUrl,
      requireViewerToken: true
    }
  }

  if (requestUrl.pathname.startsWith(displayViewerPathPrefix) || requestUrl.pathname.startsWith(displayPathPrefix)) {
    return {
      kind: 'sidecar',
      baseUrl: sidecarBaseUrl,
      path: `${requestUrl.pathname}${requestUrl.search}`,
      requestUrl,
      requireViewerToken: false
    }
  }

  return {
    kind: 'next',
    baseUrl: new URL(`http://${nextHost}:${nextPort}`),
    path: `${requestUrl.pathname}${requestUrl.search}`,
    requestUrl
  }
}

const writeProxyError = (res, statusCode, message) => {
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  })
  res.end(JSON.stringify({ message }))
}

const rewriteLocation = (location, target) => {
  try {
    const parsed = new URL(location, target.baseUrl)
    if (parsed.origin === target.baseUrl.origin) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`
    }
  } catch {
    return location
  }

  return location
}

const firstHeaderValue = value => (Array.isArray(value) ? value[0] : value)

const forwardedProto = req => firstHeaderValue(req.headers['x-forwarded-proto']) ?? 'https'

const forwardedPort = (req, host) => {
  const forwarded = firstHeaderValue(req.headers['x-forwarded-port'])
  if (forwarded) {
    return forwarded
  }

  const port = host.split(':')[1]
  if (port) {
    return port
  }

  return forwardedProto(req) === 'https' ? '443' : '80'
}

const proxyHeaders = (req, target) => {
  const publicHost = firstHeaderValue(req.headers['x-forwarded-host']) ?? firstHeaderValue(req.headers.host) ?? ''
  const proto = forwardedProto(req)
  if (target.kind === 'sidecar') {
    return {
      ...req.headers,
      host: target.baseUrl.host,
      'x-forwarded-host': publicHost,
      'x-forwarded-proto': proto,
      'x-forwarded-port': forwardedPort(req, publicHost),
      'x-rebroid-viewer-host': publicHost
    }
  }

  return {
    ...req.headers,
    host: publicHost,
    'x-forwarded-host': publicHost,
    'x-forwarded-proto': proto,
    'x-forwarded-port': forwardedPort(req, publicHost)
  }
}

const proxyHttp = (req, res, target) => {
  if (
    target.kind === 'sidecar' &&
    target.requireViewerToken !== false &&
    !isViewerRequestAuthorized(target.requestUrl, req)
  ) {
    writeProxyError(res, 403, 'Viewer token is invalid or expired.')
    return
  }

  const proxyReq = http.request(
    {
      protocol: target.baseUrl.protocol,
      hostname: target.baseUrl.hostname,
      port: target.baseUrl.port || (target.baseUrl.protocol === 'https:' ? 443 : 80),
      method: req.method,
      path: target.path,
      headers: proxyHeaders(req, target)
    },
    proxyRes => {
      const headers = { ...proxyRes.headers }
      const location = proxyRes.headers.location
      if (location) {
        headers.location = rewriteLocation(location, target)
      }

      if (target.kind === 'sidecar') {
        const token = target.requestUrl.searchParams.get(viewerTokenCookieName)
        if (token) {
          headers['set-cookie'] =
            `${viewerTokenCookieName}=${encodeURIComponent(token)}; ` +
            `Path=${viewerPathPrefix}; HttpOnly; SameSite=Lax; Max-Age=1800`
        }
      }

      res.writeHead(proxyRes.statusCode ?? 502, headers)
      proxyRes.pipe(res)
    }
  )

  proxyReq.on('error', error => {
    writeProxyError(res, 502, `Proxy request failed: ${error.message}`)
  })
  req.pipe(proxyReq)
}

const proxyUpgrade = (req, socket, head, target) => {
  if (
    target.kind === 'sidecar' &&
    target.requireViewerToken !== false &&
    !isViewerRequestAuthorized(target.requestUrl, req)
  ) {
    socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n')
    socket.destroy()
    return
  }

  const port = Number(target.baseUrl.port || 80)
  const headers = proxyHeaders(req, target)
  const upstream = net.connect(port, target.baseUrl.hostname, () => {
    upstream.write(`${req.method} ${target.path} HTTP/${req.httpVersion}\r\n`)
    for (const [name, value] of Object.entries(headers)) {
      if (value === undefined) {
        continue
      }

      upstream.write(`${name}: ${Array.isArray(value) ? value.join(', ') : value}\r\n`)
    }
    upstream.write('\r\n')
    if (head.length) {
      upstream.write(head)
    }
    upstream.pipe(socket)
    socket.pipe(upstream)
  })

  upstream.on('error', () => {
    socket.write('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n')
    socket.destroy()
  })
}

const server = https.createServer(
  {
    cert: readFileSync(tlsCertFile),
    key: readFileSync(tlsKeyFile)
  },
  (req, res) => {
    const target = targetForRequest(req)
    proxyHttp(req, res, target)
  }
)

server.on('upgrade', (req, socket, head) => {
  const target = targetForRequest(req)
  proxyUpgrade(req, socket, head, target)
})

server.listen(publicPort, '0.0.0.0', () => {
  console.log(`Rebroid web HTTPS proxy listening on 0.0.0.0:${publicPort}`)
  console.log(`Next.js standalone server listening behind proxy on ${nextHost}:${nextPort}`)
  console.log(`Display sidecar proxied from ${sidecarBaseUrl.href}`)
  console.log(`TLS certificate loaded from ${tlsCertFile}`)
})

const shutdown = () => {
  server.close()
  nextProcess.kill('SIGTERM')
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
