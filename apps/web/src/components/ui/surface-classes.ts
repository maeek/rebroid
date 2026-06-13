const focusRingClassName =
  'focus-visible:border-ring focus-visible:ring-ring/35 focus-visible:ring-[3px] focus-visible:outline-none'

const triggerResetClassName =
  'inline-flex items-center justify-center border-0 bg-transparent p-0 text-current transition-colors hover:text-primary disabled:pointer-events-none disabled:opacity-50'

const controlSurfaceClassName =
  'border border-control-border/80 bg-control text-foreground shadow-xs supports-[backdrop-filter]:bg-control/58 supports-[backdrop-filter]:backdrop-blur-xl dark:supports-[backdrop-filter]:bg-control/78 oled:border-control-border/45 oled:shadow-none oled:supports-[backdrop-filter]:bg-control/92'

const controlHoverClassName =
  'hover:border-control-border-strong/55 hover:bg-control-hover supports-[backdrop-filter]:hover:bg-control-hover/68 dark:supports-[backdrop-filter]:hover:bg-control-hover/86 oled:hover:border-control-border-strong/50 oled:supports-[backdrop-filter]:hover:bg-control-hover/92'

const chipInputSurfaceClassName =
  'border border-control-border/80 bg-control text-foreground shadow-xs transition-[background-color,border-color,box-shadow] supports-[backdrop-filter]:bg-control/58 supports-[backdrop-filter]:backdrop-blur-xl dark:supports-[backdrop-filter]:bg-control/78 oled:border-control-border/45 oled:shadow-none oled:supports-[backdrop-filter]:bg-control/92 focus-within:border-ring focus-within:ring-ring/35 focus-within:ring-[3px] hover:border-control-border-strong/55 hover:bg-control-hover supports-[backdrop-filter]:hover:bg-control-hover/68 dark:supports-[backdrop-filter]:hover:bg-control-hover/86 oled:hover:border-control-border-strong/50 oled:supports-[backdrop-filter]:hover:bg-control-hover/92'

const floatingSurfaceClassName =
  'border border-surface-border/80 bg-surface-elevated/96 text-foreground shadow-md supports-[backdrop-filter]:bg-surface-elevated/78 supports-[backdrop-filter]:backdrop-blur-2xl oled:border-surface-border/45 oled:bg-surface-elevated oled:shadow-none oled:supports-[backdrop-filter]:bg-surface-elevated/96'

const floatingLayerClassName = 'z-[70]'

const panelSurfaceClassName =
  'border border-surface-border/55 bg-surface-panel/86 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] supports-[backdrop-filter]:bg-surface-panel/48 supports-[backdrop-filter]:backdrop-blur-md oled:border-surface-border/30 oled:bg-surface-panel/92 oled:shadow-none oled:supports-[backdrop-filter]:bg-surface-panel/84'

const bandSurfaceClassName =
  'border border-surface-border/38 bg-surface-band/34 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] supports-[backdrop-filter]:bg-surface-band/24 supports-[backdrop-filter]:backdrop-blur-sm oled:border-surface-border/20 oled:bg-surface-band/72 oled:shadow-none oled:supports-[backdrop-filter]:bg-surface-band/58'

const overlayClassName = 'bg-black/64 supports-[backdrop-filter]:backdrop-blur-[2px]'

const interactiveItemClassName =
  'rounded-sm outline-none transition-colors data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50'

export {
  bandSurfaceClassName,
  chipInputSurfaceClassName,
  controlHoverClassName,
  floatingLayerClassName,
  controlSurfaceClassName,
  floatingSurfaceClassName,
  focusRingClassName,
  interactiveItemClassName,
  overlayClassName,
  panelSurfaceClassName,
  triggerResetClassName
}
