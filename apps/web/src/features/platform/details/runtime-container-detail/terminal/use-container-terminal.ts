'use client'

import { useEffect, useRef, useState } from 'react'
import type { Terminal } from '@xterm/xterm'

type TerminalStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error'
const frameLimit = 16 * 1024
const inputLimit = 64 * 1024

export const useContainerTerminal = (id?: string, startedAt?: string) => {
  const host = useRef<HTMLDivElement>(null)
  const attempt = useRef<AbortController | null>(null)
  const [status, setStatus] = useState<TerminalStatus>('idle')
  const [message, setMessage] = useState('')

  useEffect(() => () => attempt.current?.abort(), [])

  const connect = async (user: string) => {
    const element = host.current
    if (!id || !startedAt || !element) return
    attempt.current?.abort()
    const controller = new AbortController()
    attempt.current = controller
    const { signal } = controller
    let terminal: Terminal | undefined
    let socket: WebSocket | undefined
    let observer: ResizeObserver | undefined
    const close = () => {
      observer?.disconnect()
      socket?.close()
      terminal?.dispose()
    }
    signal.addEventListener('abort', close, { once: true })
    setStatus('connecting')
    setMessage('')

    try {
      const [{ Terminal }, { FitAddon }] = await Promise.all([import('@xterm/xterm'), import('@xterm/addon-fit')])
      if (signal.aborted) return
      const term = new Terminal({
        cursorBlink: true,
        disableStdin: true,
        scrollback: 2_000,
        screenReaderMode: true,
        fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
        linkHandler: { activate: () => undefined },
        theme: {
          background: getComputedStyle(element).backgroundColor,
          foreground: getComputedStyle(element).color
        }
      })
      terminal = term
      const fit = new FitAddon()
      term.loadAddon(fit)
      term.open(element)
      fit.fit()
      const url = new URL(`/terminal/docker/containers/${encodeURIComponent(id)}`, window.location.origin)
      url.protocol = 'wss:'
      url.searchParams.set('startedAt', startedAt)
      if (user) url.searchParams.set('user', user)
      const connection = new WebSocket(url)
      socket = connection
      connection.binaryType = 'arraybuffer'
      let ready = false
      let exited = false
      let failed = false
      const send = (data: object) => {
        if (connection.readyState === WebSocket.OPEN) connection.send(JSON.stringify(data))
      }
      const sendResize = ({ cols, rows }: { cols: number; rows: number }) => {
        if (ready) send({ type: 'resize', cols: Math.min(500, Math.max(2, cols)), rows: Math.min(300, rows) })
      }
      const sendInput = (bytes: Uint8Array<ArrayBuffer>) => {
        if (!ready || connection.readyState !== WebSocket.OPEN) return
        if (connection.bufferedAmount + bytes.length > inputLimit) {
          failed = true
          setMessage('Terminal input exceeded the connection buffer.')
          connection.close()
          return
        }
        for (let offset = 0; offset < bytes.length; offset += frameLimit) {
          connection.send(bytes.subarray(offset, offset + frameLimit))
        }
      }
      const encoder = new TextEncoder()
      term.onData(data => sendInput(encoder.encode(data)))
      term.onBinary(data => sendInput(Uint8Array.from(data, char => char.charCodeAt(0))))
      term.onResize(sendResize)
      observer = new ResizeObserver(() => fit.fit())
      observer.observe(element)

      connection.onmessage = ({ data }) => {
        if (signal.aborted) return
        if (data instanceof ArrayBuffer) {
          term.write(new Uint8Array(data), () => send({ type: 'ack', bytes: data.byteLength }))
          return
        }
        if (typeof data !== 'string') return
        let event: { type: 'ready' } | { type: 'exit'; code: number | null }
        try {
          event = JSON.parse(data) as typeof event
        } catch {
          connection.close()
          return
        }
        if (event.type === 'ready') {
          ready = true
          term.options.disableStdin = false
          sendResize(term)
          term.focus()
          setStatus('connected')
        } else if (event.type === 'exit') {
          exited = true
          setMessage(event.code === null ? 'Shell exited.' : `Shell exited with code ${event.code}.`)
        }
      }
      connection.onclose = event => {
        if (signal.aborted) return
        observer?.disconnect()
        term.options.disableStdin = true
        const error = failed || !ready || (event.code !== 1000 && !exited)
        setStatus(error ? 'error' : 'disconnected')
        if (!failed && !exited) {
          setMessage(event.reason || (ready ? 'Terminal connection ended.' : 'Could not connect to the terminal.'))
        }
      }
    } catch {
      if (signal.aborted) return
      controller.abort()
      setStatus('error')
      setMessage('Could not initialize the terminal.')
    }
  }

  const disconnect = () => {
    attempt.current?.abort()
    setStatus('disconnected')
    setMessage('Disconnected.')
  }

  return { host, status, message, connect, disconnect }
}
