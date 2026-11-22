'use client'

import * as React from 'react'
import { Toast as ToastPrimitives } from '@base-ui/react/toast'

type ToastVariant = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

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

const TOAST_LIMIT = 5

const toastManager = ToastPrimitives.createToastManager<ToastData>()

function normalizeToastOptions(props: ToastInput) {
  const variant = props.variant ?? props.data?.variant ?? props.type ?? 'neutral'

  return {
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
  const options = normalizeToastOptions(props)
  const id = toastManager.add({
    ...options,
    id:
      props.id ??
      (typeof props.title === 'string' && (props.description === undefined || typeof props.description === 'string')
        ? `notice:${JSON.stringify([options.type, props.title, props.description ?? ''])}`
        : undefined)
  })

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
