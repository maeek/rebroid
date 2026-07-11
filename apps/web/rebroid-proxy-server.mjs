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
const orchestratorBaseUrl = new URL(
  process.env.ORCHESTRATOR_INTERNAL_BASE_URL || process.env.ORCHESTRATOR_API_URL || 'http://rebroid-orchestrator:4100'
)
const tlsCertFile = process.env.REBROID_TLS_CERT_FILE || '/app/data/certificates/rebroid-web.crt'
const tlsKeyFile = process.env.REBROID_TLS_KEY_FILE || '/app/data/certificates/rebroid-web.key'
const viewerTokenCookieName = 'rebroid_viewer_token'
const viewerPathPrefix = '/viewer/ws-scrcpy'
const displayViewerPathPrefix = '/viewer/display'
const displayPathPrefix = '/rebroid/display'
const explicitNextAuthUrl = process.env.NEXTAUTH_URL
  ? {}
  : process.env.AUTH_URL
    ? { NEXTAUTH_URL: process.env.AUTH_URL }
    : {}
const trustProxyHeaders = process.env.REBROID_TRUST_PROXY_HEADERS === 'true'
const publicUrl = process.env.REBROID_PUBLIC_URL ? new URL(process.env.REBROID_PUBLIC_URL) : null
const allowedPublicHosts = new Set(
  (process.env.REBROID_PUBLIC_HOSTS || process.env.REBROID_TLS_HOSTS || 'localhost,127.0.0.1')
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean)
)
if (publicUrl) {
  allowedPublicHosts.add(publicUrl.host.toLowerCase())
  allowedPublicHosts.add(publicUrl.hostname.toLowerCase())
}

const nextProcess = spawn(process.execPath, [process.env.NEXT_SERVER_PATH || 'server.js'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    ...explicitNextAuthUrl,
    PORT: String(nextPort),
    HOSTNAME: nextHost,
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

  if (requestUrl.pathname === '/api/v1' || requestUrl.pathname.startsWith('/api/v1/')) {
    return {
      kind: 'orchestrator',
      baseUrl: orchestratorBaseUrl,
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

const escapeHtml = value =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const isDisplayViewerDocumentRequest = target => {
  if (target?.kind !== 'sidecar') {
    return false
  }

  const pathname = target.requestUrl?.pathname.replace(/\/$/, '')
  return pathname === displayViewerPathPrefix
}

const displayViewerUnavailableHtml = message => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Rebroid Display</title>
  <style>
    html, body {
      margin: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #000;
      color: #f8fafc;
      font: 14px system-ui, sans-serif;
    }
    main { display: grid; width: 100%; height: 100%; place-items: center; background: #000; }
    section { box-sizing: border-box; width: min(260px, calc(100% - 32px)); text-align: center; }
    .device {
      position: relative;
      width: 116px;
      height: 156px;
      margin: 0 auto 22px;
      border: 2px solid rgb(148 163 184 / 38%);
      border-radius: 28px;
      background: linear-gradient(160deg, #111827, #020617 72%);
      box-shadow: 0 24px 70px rgb(0 0 0 / 36%);
    }
    .device::before {
      position: absolute;
      top: 9px;
      left: 42px;
      width: 32px;
      height: 4px;
      border-radius: 999px;
      background: rgb(148 163 184 / 48%);
      content: "";
    }
    .device::after {
      position: absolute;
      right: 22px;
      bottom: 16px;
      left: 22px;
      height: 6px;
      border-radius: 999px;
      background: rgb(245 158 11 / 78%);
      box-shadow: 0 0 18px rgb(245 158 11 / 42%);
      content: "";
    }
    .screen-art {
      position: absolute;
      inset: 34px 18px 36px;
      display: grid;
      place-items: center;
      overflow: hidden;
      border: 1px solid rgb(148 163 184 / 28%);
      border-radius: 16px;
      background: rgb(15 23 42 / 82%);
    }
    .display-mark {
      width: 58px;
      height: 58px;
      color: rgb(245 158 11 / 86%);
      filter: drop-shadow(0 0 14px rgb(245 158 11 / 30%));
    }
    .display-mark rect, .display-mark path {
      fill: none;
      stroke: currentColor;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-width: 4;
    }
    h1 { margin: 0 0 8px; font-size: 20px; letter-spacing: 0; }
    p { margin: 8px 0 0; color: #cbd5e1; line-height: 1.45; }
  </style>
</head>
<body>
  <main>
    <section>
      <div class="device" aria-hidden="true">
        <div class="screen-art">
          <svg class="display-mark" viewBox="0 0 64 64" focusable="false" aria-hidden="true">
            <rect x="13" y="12" width="38" height="34" rx="5" />
            <path d="M24 53h16" />
            <path d="M32 46v7" />
            <path d="M22 23h20" />
            <path d="M22 32h12" />
          </svg>
        </div>
      </div>
      <h1>Live display unavailable</h1>
      <p>${escapeHtml(message)}</p>
    </section>
  </main>
</body>
</html>`

const writeProxyError = (res, statusCode, message, target = null) => {
  if (res.writableEnded) {
    return
  }

  if (res.headersSent) {
    res.destroy()
    return
  }

  if (isDisplayViewerDocumentRequest(target)) {
    res.writeHead(statusCode, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    })
    res.end(displayViewerUnavailableHtml(message))
    return
  }

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

const directHost = req => firstHeaderValue(req.headers.host) ?? ''

const hostnameFromHost = host => {
  try {
    return new URL(`https://${host}`).hostname.toLowerCase()
  } catch {
    return ''
  }
}

const publicHost = req => {
  if (publicUrl) return publicUrl.host
  if (trustProxyHeaders) return firstHeaderValue(req.headers['x-forwarded-host']) ?? directHost(req)
  return directHost(req)
}

const forwardedProto = req => {
  if (publicUrl) return publicUrl.protocol.replace(':', '')
  if (trustProxyHeaders) return firstHeaderValue(req.headers['x-forwarded-proto']) ?? 'https'
  return 'https'
}

const forwardedPort = (req, host) => {
  const forwarded = trustProxyHeaders ? firstHeaderValue(req.headers['x-forwarded-port']) : undefined
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
  const externalHost = publicHost(req)
  const proto = forwardedProto(req)
  const headers = { ...req.headers }
  delete headers['x-rebroid-sidecar-secret']
  delete headers['x-orchestrator-secret']
  headers['x-forwarded-for'] = trustProxyHeaders
    ? [firstHeaderValue(req.headers['x-forwarded-for']), req.socket.remoteAddress].filter(Boolean).join(', ')
    : req.socket.remoteAddress || ''
  if (target.kind === 'sidecar') {
    return {
      ...headers,
      host: target.baseUrl.host,
      'x-forwarded-host': externalHost,
      'x-forwarded-proto': proto,
      'x-forwarded-port': forwardedPort(req, externalHost),
      'x-rebroid-viewer-host': externalHost
    }
  }

  return {
    ...headers,
    host: externalHost,
    'x-forwarded-host': externalHost,
    'x-forwarded-proto': proto,
    'x-forwarded-port': forwardedPort(req, externalHost)
  }
}

const proxyHttp = (req, res, target) => {
  if (
    target.kind === 'sidecar' &&
    target.requireViewerToken !== false &&
    !isViewerRequestAuthorized(target.requestUrl, req)
  ) {
    writeProxyError(res, 403, 'Viewer token is invalid or expired.', target)
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
      headers['referrer-policy'] = 'no-referrer'
      headers['x-content-type-options'] = 'nosniff'
      headers['strict-transport-security'] = 'max-age=31536000; includeSubDomains'
      if (target.kind === 'sidecar') {
        headers['content-security-policy'] = "frame-ancestors 'self'; object-src 'none'; base-uri 'none'"
      }
      const location = proxyRes.headers.location
      if (location) {
        headers.location = rewriteLocation(location, target)
      }

      if (target.kind === 'sidecar') {
        const token = target.requestUrl.searchParams.get(viewerTokenCookieName)
        if (token) {
          headers['set-cookie'] =
            `${viewerTokenCookieName}=${encodeURIComponent(token)}; ` +
            `Path=${viewerPathPrefix}; HttpOnly; Secure; SameSite=Lax; Max-Age=1800`
        }
      }

      res.writeHead(proxyRes.statusCode ?? 502, headers)
      proxyRes.pipe(res)
    }
  )

  proxyReq.on('error', _error => {
    writeProxyError(
      res,
      502,
      'The display sidecar is not reachable. Reconnecting will continue from the app viewer.',
      target
    )
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
    const requestHost = publicHost(req).toLowerCase()
    if (!allowedPublicHosts.has(requestHost) && !allowedPublicHosts.has(hostnameFromHost(requestHost))) {
      writeProxyError(res, 421, 'Request host is not allowed.')
      return
    }
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
  console.log(`Orchestrator API proxied from ${orchestratorBaseUrl.href}`)
  console.log(`Display sidecar proxied from ${sidecarBaseUrl.href}`)
  console.log(`TLS certificate loaded from ${tlsCertFile}`)
})

const shutdown = () => {
  server.close()
  nextProcess.kill('SIGTERM')
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
