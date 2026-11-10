'use client'

import { useState, useTransition } from 'react'
import { viewerControlCommandEventType } from '@/features/applications/viewer/player/viewer-keyboard-relay'
import { toast } from '@/hooks/use-toast'
import { sendApplicationViewerControlAction } from '@/server/orchestrator/applications/actions/runtime/viewer-actions'
import type { ViewerControlCommandEventDetail } from '@/features/applications/viewer/player/viewer-keyboard-relay'
import type { ApplicationViewerControlCommand } from '@/shared/contracts/application'

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
  surfaceId
}: {
  appId: string
  baseControlsDisabled: boolean
  surfaceId?: string
}) => {
  const [pendingCommand, setPendingCommand] = useState<ApplicationViewerControlCommand | null>(null)
  const [isPending, startTransition] = useTransition()
  const controlsDisabled = baseControlsDisabled || isPending

  const sendControl = (command: ApplicationViewerControlCommand) => {
    if (controlsDisabled) {
      return
    }

    setPendingCommand(command)

    startTransition(async () => {
      try {
        const local = dispatchLocalViewerCommand(command, surfaceId)
        if (local) await local
        else if (!surfaceId || surfaceId === 'main') await sendApplicationViewerControlAction(appId, command)
        else throw new Error('This display is not connected.')
      } catch (error) {
        toast({
          title: 'Viewer command failed',
          description: controlErrorDescription(error),
          variant: 'danger'
        })
      } finally {
        setPendingCommand(null)
      }
    })
  }

  return { controlsDisabled, pendingCommand, sendControl }
}
