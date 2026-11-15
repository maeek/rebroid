import type { ReactNode } from 'react'
import type { ApplicationViewerControlCommand } from '@/shared/contracts/application'

export type SendControl = (command: ApplicationViewerControlCommand) => void

export type ControlIconRenderer = (command: ApplicationViewerControlCommand, icon: ReactNode) => ReactNode

export type IconControl = {
  command: ApplicationViewerControlCommand
  label: string
  icon: ReactNode
}
