'use client'

import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from '@/components/ui/toast'
import { Visible } from '@/components/ui/visible'
import { useToast } from '@/hooks/use-toast'

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast
            key={id}
            {...props}
          >
            <div className='grid flex-1 gap-1 pr-2'>
              <Visible when={title}>
                <ToastTitle>{title}</ToastTitle>
              </Visible>
              <Visible when={description}>
                <ToastDescription>{description}</ToastDescription>
              </Visible>
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
