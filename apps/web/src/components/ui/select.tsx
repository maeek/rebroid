'use client'

import * as React from 'react'
import { Select as SelectPrimitive } from '@base-ui/react/select'
import { IconCheck, IconChevronDown, IconChevronUp } from '@tabler/icons-react'
import { getBaseChildren, getBaseRender } from '@/components/ui/base-render'
import {
  controlHoverClassName,
  floatingLayerClassName,
  controlSurfaceClassName,
  floatingSurfaceClassName,
  focusRingClassName,
  interactiveItemClassName
} from '@/components/ui/surface'
import { cn } from '@/lib/utils'

type SelectLabelRegistry = {
  labels: Map<string, string>
  registerLabel: (value: string, label: string) => () => void
}

const SelectLabelContext = React.createContext<SelectLabelRegistry | null>(null)

type SelectItemProps = Omit<React.ComponentProps<typeof SelectPrimitive.Item>, 'value'> & {
  value?: string
}

type SelectRootProps<Value extends string = string> = Omit<
  SelectPrimitive.Root.Props<Value>,
  'defaultValue' | 'multiple' | 'onValueChange' | 'value'
> & {
  defaultValue?: Value
  onValueChange?: (value: Value) => void
  value?: Value
}

const getSelectItemText = (children: React.ReactNode): string => {
  if (children === null || children === undefined || typeof children === 'boolean') {
    return ''
  }

  if (typeof children === 'string' || typeof children === 'number') {
    return String(children)
  }

  if (Array.isArray(children)) {
    const childNodes = children as React.ReactNode[]

    return childNodes
      .map(child => getSelectItemText(child))
      .filter(Boolean)
      .join(' ')
  }

  if (React.isValidElement<{ children?: React.ReactNode }>(children)) {
    return getSelectItemText(children.props.children)
  }

  return ''
}

const collectSelectLabels = (children: React.ReactNode, labels = new Map<string, string>()) => {
  React.Children.forEach(children, child => {
    if (!React.isValidElement<{ children?: React.ReactNode; label?: unknown; value?: unknown }>(child)) {
      return
    }

    const itemValue = child.props.value

    if (child.type === SelectItem && typeof itemValue === 'string') {
      const label = typeof child.props.label === 'string' ? child.props.label : getSelectItemText(child.props.children)

      if (label.length > 0) {
        labels.set(itemValue, label)
      }
    }

    collectSelectLabels(child.props.children, labels)
  })

  return labels
}

function Select<Value extends string = string>({ onValueChange, children, ...props }: SelectRootProps<Value>) {
  const staticLabels = React.useMemo(() => collectSelectLabels(children), [children])
  const [registeredLabels, setRegisteredLabels] = React.useState(() => new Map<string, string>())

  const registerLabel = React.useCallback((value: string, label: string) => {
    setRegisteredLabels(current => {
      if (current.get(value) === label) {
        return current
      }

      const next = new Map(current)
      next.set(value, label)
      return next
    })

    return () => {
      setRegisteredLabels(current => {
        if (current.get(value) !== label) {
          return current
        }

        const next = new Map(current)
        next.delete(value)
        return next
      })
    }
  }, [])

  const labels = React.useMemo(() => new Map([...staticLabels, ...registeredLabels]), [registeredLabels, staticLabels])

  const labelContext = React.useMemo<SelectLabelRegistry>(
    () => ({
      labels,
      registerLabel
    }),
    [labels, registerLabel]
  )

  return (
    <SelectLabelContext.Provider value={labelContext}>
      <SelectPrimitive.Root
        data-slot='select'
        onValueChange={value => {
          if (value !== null) {
            onValueChange?.(value)
          }
        }}
        {...props}
      >
        {children}
      </SelectPrimitive.Root>
    </SelectLabelContext.Provider>
  )
}

function SelectValue({ children, placeholder, ...props }: React.ComponentProps<typeof SelectPrimitive.Value>) {
  const labelContext = React.useContext(SelectLabelContext)

  return (
    <SelectPrimitive.Value
      data-slot='select-value'
      placeholder={placeholder}
      {...props}
    >
      {value => {
        if (typeof children === 'function') {
          return children(value)
        }

        if (children !== undefined && children !== null) {
          return children
        }

        if (value === null || value === undefined || value === '') {
          return placeholder
        }

        if (Array.isArray(value)) {
          return value.map(item => labelContext?.labels.get(String(item)) ?? String(item)).join(', ')
        }

        return labelContext?.labels.get(String(value)) ?? String(value)
      }}
    </SelectPrimitive.Value>
  )
}

function SelectTrigger({
  className,
  size = 'default',
  children,
  asChild,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: 'sm' | 'default'
  asChild?: boolean
}) {
  const view = getBaseRender(asChild, children)

  return (
    <SelectPrimitive.Trigger
      data-slot='select-trigger'
      data-size={size}
      render={view}
      className={cn(
        "data-[placeholder]:text-foreground-muted [&_svg:not([class*='text-'])]:text-foreground aria-invalid:ring-danger/20 dark:aria-invalid:ring-danger/40 aria-invalid:border-danger flex w-fit items-center justify-between gap-2 rounded-control px-4 py-3 text-sm whitespace-nowrap transition-[color,box-shadow,background-color,border-color] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        controlSurfaceClassName,
        controlHoverClassName,
        focusRingClassName,
        className
      )}
      {...props}
    >
      {getBaseChildren(asChild, children)}
      <SelectPrimitive.Icon>
        <IconChevronDown className='size-4 opacity-60' />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  position = 'popper',
  align = 'center',
  side = 'bottom',
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Popup> & {
  position?: 'popper' | 'item-aligned'
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'right' | 'bottom' | 'left'
  sideOffset?: number
}) {
  const alignItemWithTrigger = position !== 'popper'

  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        align={align}
        alignItemWithTrigger={alignItemWithTrigger}
        className={floatingLayerClassName}
        side={side}
        sideOffset={sideOffset}
      >
        <SelectPrimitive.Popup
          data-slot='select-content'
          className={cn(
            'scrollbar-thin relative z-50 max-h-[min(var(--available-height),24rem)] min-w-[8rem] overflow-x-hidden overflow-y-auto rounded-control data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0 data-[closed]:zoom-out-95 data-[open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
            {
              'min-w-[var(--anchor-width)]': position === 'popper'
            },
            floatingSurfaceClassName,
            className
          )}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List className='p-1'>{children}</SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectItem({ className, children, value, ...props }: SelectItemProps) {
  const labelContext = React.useContext(SelectLabelContext)
  const registerLabel = labelContext?.registerLabel
  const explicitLabel = typeof props.label === 'string' ? props.label : undefined
  const label = React.useMemo(() => explicitLabel ?? getSelectItemText(children), [children, explicitLabel])

  React.useLayoutEffect(() => {
    if (!registerLabel || value === undefined || label.length === 0) {
      return undefined
    }

    return registerLabel(value, label)
  }, [label, registerLabel, value])

  return (
    <SelectPrimitive.Item
      data-slot='select-item'
      className={cn(
        "relative flex w-full cursor-default items-center gap-2 py-1.5 pr-8 pl-2 text-sm select-none [&_svg:not([class*='text-'])]:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        interactiveItemClassName,
        className
      )}
      value={value}
      {...props}
    >
      <span className='absolute right-2 flex size-3.5 items-center justify-center'>
        <SelectPrimitive.ItemIndicator>
          <IconCheck className='size-4' />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

function SelectScrollUpButton({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot='select-scroll-up-button'
      className={cn('flex cursor-default items-center justify-center py-1', className)}
      {...props}
    >
      <IconChevronUp className='size-4' />
    </SelectPrimitive.ScrollUpArrow>
  )
}

function SelectScrollDownButton({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot='select-scroll-down-button'
      className={cn('flex cursor-default items-center justify-center py-1', className)}
      {...props}
    >
      <IconChevronDown className='size-4' />
    </SelectPrimitive.ScrollDownArrow>
  )
}

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue }
