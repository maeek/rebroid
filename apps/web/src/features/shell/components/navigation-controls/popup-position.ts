export const navigationPopupPositions = {
  header: { side: 'bottom', align: 'end', sideOffset: 8 },
  sidebar: { side: 'top', align: 'start', sideOffset: 8 },
  // Clear the 12px between a rail button and the rail edge before adding the popup gap.
  rail: { side: 'right', align: 'end', sideOffset: 20 }
} as const

export type NavigationPopupPosition = { side: 'top' | 'right' | 'bottom'; align: 'start' | 'end'; sideOffset: number }
