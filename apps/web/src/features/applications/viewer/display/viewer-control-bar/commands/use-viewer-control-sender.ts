'use client'

import { useLayoutEffect, useMemo, useState } from 'react'
import { viewerControlCommandEventType } from '@/features/applications/viewer/player/viewer-keyboard-relay'
import { toast } from '@/hooks/use-toast'
import { sendApplicationViewerControlAction } from '@/server/orchestrator/applications/actions/runtime/viewer-actions'
import type { ViewerControlCommandEventDetail } from '@/features/applications/viewer/player/viewer-keyboard-relay'
import type { ApplicationViewerControlCommand } from '@/shared/contracts/application'

const maxPendingCommands = 8
const isRepeatable = (command: ApplicationViewerControlCommand) => command === 'volume-up' || command === 'volume-down'

const controlErrorDescription = (error: unknown) => {
  const message = error instanceof Error ? error.message.trim() : ''
  const lowerMessage = message.toLowerCase()
  const genericErrorTerms = ['sidecar', 'adb', 'nestjs', 'nextjs', 'next.js', 'fetch failed']

  if (!message || genericErrorTerms.some(term => lowerMessage.includes(term))) {
    return 'The viewer could not send that command. Refresh the viewer or restart the app, then try again.'
  }

  return message
}

const dispatchLocalViewerCommand = (command: ApplicationViewerControlCommand, surfaceId?: string) => {
  let onResult: (error?: string) => void = () => undefined
  const result = new Promise<void>((resolve, reject) => {
    onResult = error => {
      if (error) reject(new Error(error))
      else resolve()
    }
  })
  const event = new CustomEvent<ViewerControlCommandEventDetail>(viewerControlCommandEventType, {
    cancelable: true,
    detail: { command, surfaceId, onResult }
  })
  return window.dispatchEvent(event) ? undefined : result
}

export const useViewerControlSender = ({
  appId,
  baseControlsDisabled,
  surfaceId,
  frameKey
}: {
  appId: string
  baseControlsDisabled: boolean
  surfaceId?: string
  frameKey?: string
}) => {
  const queue = useMemo(
    () => ({
      appId,
      surfaceId,
      frameKey,
      baseControlsDisabled,
      active: true,
      commands: [] as ApplicationViewerControlCommand[]
    }),
    [appId, baseControlsDisabled, frameKey, surfaceId]
  )
  const [feedback, setFeedback] = useState<{ queue: typeof queue; commands: ApplicationViewerControlCommand[] }>()
  const pending = feedback?.queue === queue ? feedback.commands : []
  useLayoutEffect(() => {
    queue.active = true
    return () => {
      queue.active = false
      queue.commands.length = 0
    }
  }, [queue])

  const publishPending = () => {
    if (queue.active) setFeedback({ queue, commands: [...queue.commands] })
  }

  const drain = async () => {
    let usingDisplay = false
    while (queue.active && queue.commands.length > 0) {
      const command = queue.commands[0]
      try {
        const local = dispatchLocalViewerCommand(command, queue.surfaceId)
        if (local) {
          usingDisplay = true
          await local
        } else if (!usingDisplay && (!queue.surfaceId || queue.surfaceId === 'main'))
          await sendApplicationViewerControlAction(queue.appId, command)
        else throw new Error('This display is not connected.')
      } catch (error) {
        if (!queue.active) return
        const description = controlErrorDescription(error)
        toast({
          title: 'Viewer command failed',
          description: queue.commands.length > 1 ? `${description} Other pending commands were cleared.` : description,
          variant: 'danger'
        })
        queue.commands.length = 0
        publishPending()
        return
      }
      queue.commands.shift()
      publishPending()
    }
  }

  const commandDisabled = (command: ApplicationViewerControlCommand, commands = pending) =>
    queue.baseControlsDisabled ||
    commands.length >= maxPendingCommands ||
    (!isRepeatable(command) && commands.includes(command))

  const sendControl = (command: ApplicationViewerControlCommand) => {
    if (!queue.active || commandDisabled(command, queue.commands)) return
    queue.commands.push(command)
    publishPending()
    if (queue.commands.length === 1) void drain()
  }

  return {
    commandDisabled,
    isCommandPending: (command: ApplicationViewerControlCommand) => pending.includes(command),
    sendControl
  }
}
