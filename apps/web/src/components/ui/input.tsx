import * as React from 'react'
import { controlHoverClassName, controlSurfaceClassName, focusRingClassName } from '@/components/ui/surface'
import { cn } from '@/lib/utils'

type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const inputBaseClassName = cn(
  'h-9 min-w-0 w-full rounded-control text-sm transition-[background-color,border-color,color,box-shadow] duration-75 placeholder:text-foreground-muted disabled:cursor-not-allowed disabled:opacity-50',
  controlSurfaceClassName,
  controlHoverClassName,
  focusRingClassName
)

const textInputClassName = 'px-4 py-1'

const fileInputClassName =
  'cursor-pointer overflow-hidden p-0 text-foreground [&::file-selector-button]:mr-4 [&::file-selector-button]:h-full [&::file-selector-button]:border-0 [&::file-selector-button]:border-r [&::file-selector-button]:border-control-border [&::file-selector-button]:bg-transparent [&::file-selector-button]:px-4 [&::file-selector-button]:text-sm [&::file-selector-button]:font-medium [&::file-selector-button]:text-foreground [&::file-selector-button]:transition-colors [&::file-selector-button]:duration-75 [&::file-selector-button]:cursor-pointer [&::file-selector-button]:hover:bg-control-hover [&::-webkit-file-upload-button]:mr-4 [&::-webkit-file-upload-button]:h-full [&::-webkit-file-upload-button]:border-0 [&::-webkit-file-upload-button]:border-r [&::-webkit-file-upload-button]:border-control-border [&::-webkit-file-upload-button]:bg-transparent [&::-webkit-file-upload-button]:px-4 [&::-webkit-file-upload-button]:text-sm [&::-webkit-file-upload-button]:font-medium [&::-webkit-file-upload-button]:text-foreground [&::-webkit-file-upload-button]:transition-colors [&::-webkit-file-upload-button]:duration-75 [&::-webkit-file-upload-button]:cursor-pointer [&::-webkit-file-upload-button]:hover:bg-control-hover'

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  const inputClassName = type === 'file' ? fileInputClassName : textInputClassName

  return (
    <input
      type={type}
      className={cn(inputBaseClassName, inputClassName, className)}
      ref={ref}
      {...props}
    />
  )
})
Input.displayName = 'Input'

export { Input }
