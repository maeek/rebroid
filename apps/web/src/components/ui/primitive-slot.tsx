import * as React from 'react'
import { cn } from '@/lib/utils'

type SlotProps = React.HTMLAttributes<HTMLElement> & {
  children?: React.ReactNode
}

type ActiveRef<T> = React.RefCallback<T> | React.RefObject<T | null>

function isActiveRef<T>(ref: React.Ref<T> | null | undefined): ref is ActiveRef<T> {
  return ref !== null && ref !== undefined
}

function composeRefs<T>(...refs: Array<React.Ref<T> | null | undefined>) {
  const activeRefs = refs.filter(isActiveRef)
  if (activeRefs.length === 0) {
    return undefined
  }

  return (node: T | null) => {
    for (const ref of activeRefs) {
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
  const composedRef = composeRefs(ref, childRef)

  const nextProps = {
    ...props,
    ...childProps,
    className: cn(className, childProps.className),
    style: {
      ...style,
      ...childProps.style
    }
  } as React.HTMLAttributes<HTMLElement> & React.Attributes & { ref?: React.Ref<HTMLElement> }
  if (composedRef) {
    nextProps.ref = composedRef
  }

  return React.cloneElement(
    children as React.ReactElement<Record<string, unknown>>,
    nextProps as unknown as Partial<Record<string, unknown>> & React.Attributes
  )
})
PrimitiveSlot.displayName = 'PrimitiveSlot'

export { PrimitiveSlot }
