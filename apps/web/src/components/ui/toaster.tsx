'use client'

import {
  Toast,
  ToastClose,
  ToastContent,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport
} from '@/components/ui/toast'
import { Visible } from '@/components/ui/visible'
import { TOAST_LIMIT, toastManager, useToast } from '@/hooks/use-toast'

export function Toaster() {
  return (
    <ToastProvider
      limit={TOAST_LIMIT}
      toastManager={toastManager}
    >
      <ToastViewport>
        <ToastList />
      </ToastViewport>
    </ToastProvider>
  )
}

function ToastList() {
  const { toasts } = useToast()

  return (
    <>
      {toasts.map(currentToast => {
        const { id, title, description } = currentToast
        const variant = currentToast.data?.variant ?? 'neutral'

        return (
          <Toast
            key={id}
            data-testid={`toast-${variant}`}
            toast={currentToast}
            variant={variant}
          >
            <ToastContent>
              <Visible when={title}>
                <ToastTitle>{title}</ToastTitle>
              </Visible>
              <Visible when={description}>
                <ToastDescription>{description}</ToastDescription>
              </Visible>
            </ToastContent>
            <ToastClose />
          </Toast>
        )
      })}
    </>
  )
}
