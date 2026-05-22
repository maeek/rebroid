/* eslint-disable no-console */
import { spawn } from 'node:child_process'
import { createHmac, timingSafeEqual } from 'node:crypto'
import http from 'node:http'
import net from 'node:net'

const publicPort = Number(process.env.PORT || 3001)
const nextPort = Number(process.env.NEXT_INTERNAL_PORT || 3101)
const nextHost = process.env.NEXT_INTERNAL_HOST || '127.0.0.1'
const sidecarBaseUrl = new URL(process.env.WS_SCRCPY_INTERNAL_BASE_URL || 'http://rebroid-ws-scrcpy:8000')
const viewerTokenCookieName = 'rebroid_viewer_token'
const viewerPathPrefix = '/viewer/ws-scrcpy'
const wsScrcpyViewerCss = `
html,
body,
main,
.device-view,
.video,
.video-layer,
.touch-layer {
  width: 100% !important;
  height: 100% !important;
  min-width: 0 !important;
  min-height: 0 !important;
}
body.stream {
  margin: 0 !important;
  overflow: hidden !important;
}
.device-view {
  position: relative !important;
}
.video {
  position: absolute !important;
  inset: 0 !important;
  display: flex !important;
  align-items: stretch !important;
  justify-content: stretch !important;
}
.video-layer,
.touch-layer {
  position: absolute !important;
  inset: 0 !important;
}
.video-layer video,
.video-layer canvas {
  width: 100% !important;
  height: 100% !important;
  object-fit: contain !important;
  display: block !important;
}
.control-buttons-list,
.control-wrapper,
.more-box {
  display: none !important;
  visibility: hidden !important;
  pointer-events: none !important;
}
`

const createWsScrcpyViewerBootstrap = requestUrl => {
  const udid = requestUrl.searchParams.get('udid') || ''
  const player = requestUrl.searchParams.get('player') || 'mse'
  const bitrateMbps = Number(requestUrl.searchParams.get('bitrateMbps') || 0)
  const maxFps = Number(requestUrl.searchParams.get('maxFps') || 0)
  const maxSize = Number(requestUrl.searchParams.get('maxSize') || 0)
  const iFrameInterval = Number(requestUrl.searchParams.get('iFrameInterval') || 0)
  const fitToFrame = requestUrl.searchParams.get('fitToFrame') === '1'
  const settings = {
    bitrate: Number.isFinite(bitrateMbps) && bitrateMbps > 0 ? bitrateMbps * 1_000_000 : undefined,
    maxFps: Number.isFinite(maxFps) && maxFps > 0 ? maxFps : undefined,
    iFrameInterval: Number.isFinite(iFrameInterval) && iFrameInterval > 0 ? iFrameInterval : undefined,
    lockedVideoOrientation: -1,
    bounds:
      Number.isFinite(maxSize) && maxSize > 0
        ? {
            width: maxSize,
            height: maxSize
          }
        : undefined,
    sendFrameMeta: false,
    displayId: 0
  }

  return `
(() => {
  const udid = ${JSON.stringify(udid)};
  const keyboardCaptureMessageType = 'rebroid-viewer-keyboard-capture';
  const keyboardEventMessageType = 'rebroid-viewer-keyboard-event';
  let keyboardCaptureEnabled = false;
  if (!udid || !window.localStorage) {
    return;
  }

  const player = ${JSON.stringify(player)}.toLowerCase();
  let prefixes = ['MseDecoder'];
  if (player.includes('webcodecs')) {
    prefixes = ['WebCodecsPlayer'];
  } else if (player.includes('broadway')) {
    prefixes = ['BroadwayDecoder'];
  } else if (player.includes('tinyh264')) {
    prefixes = ['Tinyh264Decoder'];
  }
  const videoSettings = ${JSON.stringify(settings)};
  const fitToFrame = ${JSON.stringify(fitToFrame)};
  const viewportKey = window.innerWidth + 'x' + window.innerHeight;
  if (window.localStorage) {
    for (const prefix of prefixes) {
      const key = prefix + ':' + udid + ':' + viewportKey;
      window.localStorage.setItem(key, JSON.stringify(videoSettings));
      window.localStorage.setItem(key + ':fit', JSON.stringify(fitToFrame));
    }
  }

  const focusViewer = () => {
    const focusTarget =
      document.querySelector('.touch-layer') ||
      document.querySelector('.video-layer canvas') ||
      document.querySelector('.video-layer video') ||
      document.body;

    if (focusTarget instanceof HTMLElement) {
      if (!focusTarget.hasAttribute('tabindex')) {
        focusTarget.setAttribute('tabindex', '-1');
      }
      focusTarget.focus({ preventScroll: true });
    }

    if (document.body instanceof HTMLElement) {
      if (!document.body.hasAttribute('tabindex')) {
        document.body.setAttribute('tabindex', '-1');
      }
      document.body.focus({ preventScroll: true });
    }

    window.focus();
  };

  const dispatchKeyboardEvent = (data) => {
    if (!keyboardCaptureEnabled) {
      return;
    }

    const eventType = data && data.eventType;
    if (eventType !== 'keydown' && eventType !== 'keyup') {
      return;
    }

    const keyboardEvent = new KeyboardEvent(eventType, {
      key: typeof data.key === 'string' ? data.key : '',
      code: typeof data.code === 'string' ? data.code : '',
      location: typeof data.location === 'number' ? data.location : 0,
      repeat: Boolean(data.repeat),
      altKey: Boolean(data.altKey),
      ctrlKey: Boolean(data.ctrlKey),
      metaKey: Boolean(data.metaKey),
      shiftKey: Boolean(data.shiftKey),
      bubbles: true,
      cancelable: true
    });
    const modifierState = {
      Alt: Boolean(data.altKey),
      AltGraph: false,
      CapsLock: Boolean(data.capsLock),
      Control: Boolean(data.ctrlKey),
      Meta: Boolean(data.metaKey),
      NumLock: Boolean(data.numLock),
      ScrollLock: Boolean(data.scrollLock),
      Shift: Boolean(data.shiftKey)
    };

    Object.defineProperty(keyboardEvent, 'getModifierState', {
      value: (key) => Boolean(modifierState[key]),
      configurable: true
    });

    document.body.dispatchEvent(keyboardEvent);
  };

  const syncKeyboardCapture = () => {
    const keyboardToggle = document.querySelector(
      'input[id^="input_capture_keyboard_"], input[id^="capture_keyboard_"], input[id*="capture_keyboard"]'
    );
    if (!(keyboardToggle instanceof HTMLInputElement)) {
      return false;
    }

    if (keyboardToggle.checked !== keyboardCaptureEnabled) {
      keyboardToggle.click();
    }

    return true;
  };

  const applyKeyboardCapturePreference = (enabled) => {
    keyboardCaptureEnabled = enabled;

    const trySync = () => {
      if (!syncKeyboardCapture()) {
        window.setTimeout(trySync, 150);
        return;
      }

      if (keyboardCaptureEnabled) {
        focusViewer();
      }
    };

    trySync();
  };

  const handleViewerPointerDown = () => {
    if (keyboardCaptureEnabled) {
      focusViewer();
    }
  };

  const handleKeyboardCaptureMessage = (event) => {
    if (event.origin !== window.location.origin) {
      return;
    }

    const data = event.data;
    if (!data || typeof data !== 'object') {
      return;
    }

    if (data.type === keyboardEventMessageType) {
      dispatchKeyboardEvent(data);
      return;
    }

    if (data.type !== keyboardCaptureMessageType || typeof data.enabled !== 'boolean') {
      return;
    }

    applyKeyboardCapturePreference(data.enabled);
  };

  document.addEventListener('pointerdown', handleViewerPointerDown, true);
  document.addEventListener('mousedown', handleViewerPointerDown, true);
  document.addEventListener('touchstart', handleViewerPointerDown, true);
  window.addEventListener('message', handleKeyboardCaptureMessage);
})();`
}

const nextProcess = spawn(process.execPath, ['server.js'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT: String(nextPort),
    HOSTNAME: nextHost
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
  if (action && action !== 'proxy-adb') {
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
    return {
      kind: 'sidecar',
      baseUrl: sidecarBaseUrl,
      path: `${requestUrl.pathname}${requestUrl.search}`,
      requestUrl
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

const forwardedProto = req => firstHeaderValue(req.headers['x-forwarded-proto']) ?? 'http'

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
  if (target.kind === 'sidecar') {
    return {
      ...req.headers,
      host: target.baseUrl.host
    }
  }

  const publicHost = firstHeaderValue(req.headers['x-forwarded-host']) ?? firstHeaderValue(req.headers.host) ?? ''
  return {
    ...req.headers,
    host: publicHost,
    'x-forwarded-host': publicHost,
    'x-forwarded-proto': forwardedProto(req),
    'x-forwarded-port': forwardedPort(req, publicHost)
  }
}

const proxyHttp = (req, res, target) => {
  if (target.kind === 'sidecar' && !isViewerRequestAuthorized(target.requestUrl, req)) {
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
            `${viewerTokenCookieName}=${encodeURIComponent(token)}; Path=${viewerPathPrefix}; HttpOnly; SameSite=Lax; Max-Age=1800`
        }
      }

      const contentType = firstHeaderValue(proxyRes.headers['content-type']) ?? ''
      const shouldInjectViewerCss =
        target.kind === 'sidecar' &&
        target.requestUrl.pathname.replace(/\/+$/, '') === viewerPathPrefix &&
        contentType.includes('text/html')

      if (shouldInjectViewerCss) {
        delete headers['content-length']
        const chunks = []
        proxyRes.on('data', chunk => chunks.push(Buffer.from(chunk)))
        proxyRes.on('end', () => {
          const html = Buffer.concat(chunks).toString('utf8')
          const bootstrap = `<style>${wsScrcpyViewerCss}</style><script>${createWsScrcpyViewerBootstrap(target.requestUrl)}</script>`
          const patchedHtml = html.includes('</head>')
            ? html.replace('</head>', `${bootstrap}</head>`)
            : `${html}${bootstrap}`
          res.writeHead(proxyRes.statusCode ?? 502, headers)
          res.end(patchedHtml)
        })
        return
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
  if (target.kind === 'sidecar' && !isViewerRequestAuthorized(target.requestUrl, req)) {
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

const server = http.createServer((req, res) => {
  const target = targetForRequest(req)
  proxyHttp(req, res, target)
})

server.on('upgrade', (req, socket, head) => {
  const target = targetForRequest(req)
  proxyUpgrade(req, socket, head, target)
})

server.listen(publicPort, '0.0.0.0', () => {
  console.log(`Rebroid web proxy listening on 0.0.0.0:${publicPort}`)
  console.log(`Next.js standalone server listening behind proxy on ${nextHost}:${nextPort}`)
  console.log(`ws-scrcpy sidecar proxied from ${sidecarBaseUrl.href}`)
})

const shutdown = () => {
  server.close()
  nextProcess.kill('SIGTERM')
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
