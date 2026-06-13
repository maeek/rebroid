import * as React from 'react'
import { cn } from '@/lib/utils'

type SlotProps = React.HTMLAttributes<HTMLElement> & {
  children?: React.ReactNode
}

function composeRefs<T>(...refs: Array<React.Ref<T> | undefined>) {
  return (node: T | null) => {
    for (const ref of refs) {
      if (!ref) {
        continue
      }
      if (typeof ref === 'function') {
        ref(node)
      } else {
        ref.current = node
      }
    }
  }
}

const PrimitiveSlot = React.forwardRef<HTMLElement, SlotProps>(({ children, className, style, ...props }, ref) => {
  if (!React.isValidElement(children)) {
    return null
  }

  const childProps = children.props as React.HTMLAttributes<HTMLElement>
  const childRef = (children as React.ReactElement & { ref?: React.Ref<HTMLElement> }).ref

  const nextProps = {
    ...props,
    ...childProps,
    className: cn(className, childProps.className),
    style: {
      ...style,
      ...childProps.style
    },
    ref: composeRefs(ref, childRef)
  } as React.HTMLAttributes<HTMLElement> & React.Attributes & { ref?: React.Ref<HTMLElement> }

  return React.cloneElement(
    children as React.ReactElement<Record<string, unknown>>,
    nextProps as unknown as Partial<Record<string, unknown>> & React.Attributes
  )
})
PrimitiveSlot.displayName = 'PrimitiveSlot'

export { PrimitiveSlot }
