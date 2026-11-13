import motion from './resource-navigation-motion.module.css'

export const resourceNavigationListClassName = [
  motion.navigation,
  'flex min-w-0 gap-1 overflow-x-auto rounded-panel bg-surface-editor p-1'
].join(' ')

export const resourceNavigationItemClassName =
  'touch-control relative shrink-0 rounded-control px-3 py-2.5 text-sm font-medium whitespace-nowrap text-foreground-muted'

export const resourceNavigationInteractiveClassName =
  'transition-colors duration-160 motion-reduce:transition-none hover:bg-control-hover/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export const resourceNavigationActiveClassName =
  'bg-primary/10 text-primary after:absolute after:bottom-0 after:left-1/2 after:h-0.5 after:w-6 after:-translate-x-1/2 after:rounded-full after:bg-primary'
