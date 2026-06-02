import * as React from 'react'
import { cn } from '@/lib/utils'

type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const inputBaseClassName =
  'h-9 w-full rounded-md border border-border/70 bg-input/72 text-sm backdrop-blur-xs transition-[background-color,border-color,color] duration-75 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary/60 hover:bg-input/84 disabled:cursor-not-allowed disabled:opacity-50'

const textInputClassName = 'px-4 py-1 hover:border-primary/40'

const fileInputClassName =
  'cursor-pointer overflow-hidden p-0 text-foreground hover:border-primary/40 [&::file-selector-button]:mr-4 [&::file-selector-button]:h-full [&::file-selector-button]:border-0 [&::file-selector-button]:border-r [&::file-selector-button]:border-primary/15 [&::file-selector-button]:bg-transparent [&::file-selector-button]:px-4 [&::file-selector-button]:text-sm [&::file-selector-button]:font-medium [&::file-selector-button]:text-foreground [&::file-selector-button]:transition-colors [&::file-selector-button]:duration-75 [&::file-selector-button]:cursor-pointer [&::file-selector-button]:hover:bg-primary/5 [&::-webkit-file-upload-button]:mr-4 [&::-webkit-file-upload-button]:h-full [&::-webkit-file-upload-button]:border-0 [&::-webkit-file-upload-button]:border-r [&::-webkit-file-upload-button]:border-primary/15 [&::-webkit-file-upload-button]:bg-transparent [&::-webkit-file-upload-button]:px-4 [&::-webkit-file-upload-button]:text-sm [&::-webkit-file-upload-button]:font-medium [&::-webkit-file-upload-button]:text-foreground [&::-webkit-file-upload-button]:transition-colors [&::-webkit-file-upload-button]:duration-75 [&::-webkit-file-upload-button]:cursor-pointer [&::-webkit-file-upload-button]:hover:bg-primary/5'

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
