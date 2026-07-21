'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
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

const clearLocalPendingTimer = (timerRef: { current: number | null }) => {
  if (timerRef.current !== null) {
    window.clearTimeout(timerRef.current)
    timerRef.current = null
  }
}

const dispatchLocalViewerCommand = (command: ApplicationViewerControlCommand, surfaceId?: string) => {
  if (typeof window === 'undefined') {
    return false
  }

  return !window.dispatchEvent(
    new CustomEvent<ViewerControlCommandEventDetail>(viewerControlCommandEventType, {
      cancelable: true,
      detail: { command, surfaceId }
    })
  )
}

const runRotateSideEffect = (command: ApplicationViewerControlCommand, onRotateViewer?: () => void) => {
  if (command === 'rotate') {
    onRotateViewer?.()
  }
}

export const useViewerControlSender = ({
  appId,
  baseControlsDisabled,
  surfaceId,
  onRotateViewer
}: {
  appId: string
  baseControlsDisabled: boolean
  surfaceId?: string
  onRotateViewer?: () => void
}) => {
  const [pendingCommand, setPendingCommand] = useState<ApplicationViewerControlCommand | null>(null)
  const [isPending, startTransition] = useTransition()
  const localPendingTimer = useRef<number | null>(null)
  const controlsDisabled = baseControlsDisabled || isPending

  useEffect(() => {
    return () => clearLocalPendingTimer(localPendingTimer)
  }, [])

  const sendControl = (command: ApplicationViewerControlCommand) => {
    if (controlsDisabled) {
      return
    }

    setPendingCommand(command)

    if (dispatchLocalViewerCommand(command, surfaceId)) {
      runRotateSideEffect(command, onRotateViewer)
      clearLocalPendingTimer(localPendingTimer)
      localPendingTimer.current = window.setTimeout(() => setPendingCommand(null), 160)
      return
    }

    startTransition(async () => {
      try {
        await sendApplicationViewerControlAction(appId, command)
        runRotateSideEffect(command, onRotateViewer)
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
