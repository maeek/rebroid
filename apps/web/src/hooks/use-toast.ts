'use client'

import * as React from 'react'
import { Toast as ToastPrimitives } from '@base-ui/react/toast'

type ToastVariant = 'neutral' | 'danger'

type ToastData = {
  variant?: ToastVariant
}

type ToastInput = {
  id?: string
  title?: React.ReactNode
  description?: React.ReactNode
  variant?: ToastVariant
  type?: ToastVariant
  timeout?: number
  priority?: 'low' | 'high'
  data?: ToastData
  onClose?: () => void
  onRemove?: () => void
}

type ToasterToast = ToastPrimitives.Root.ToastObject<ToastData>

const TOAST_LIMIT = 5

const toastManager = ToastPrimitives.createToastManager<ToastData>()

function normalizeToastOptions(props: ToastInput) {
  const variant = props.variant ?? props.data?.variant ?? props.type ?? 'neutral'

  return {
    id: props.id,
    title: props.title,
    description: props.description,
    type: variant,
    timeout: props.timeout,
    priority: props.priority,
    data: {
      ...props.data,
      variant
    },
    onClose: props.onClose,
    onRemove: props.onRemove
  }
}

function toast({ ...props }: ToastInput) {
  const id = toastManager.add(normalizeToastOptions(props))

  const update = (innerProps: ToastInput) => {
    toastManager.update(id, normalizeToastOptions(innerProps))
  }
  const dismiss = () => toastManager.close(id)

  return {
    id,
    dismiss,
    update
  }
}

function useToast() {
  const manager = ToastPrimitives.useToastManager<ToastData>()

  return {
    toasts: manager.toasts,
    toast,
    dismiss: manager.close
  }
}

export { TOAST_LIMIT, toastManager, useToast, toast }
export type { ToastData, ToastInput, ToasterToast, ToastVariant }
