import type { GappsBuildPhase } from '@/shared/contracts/platform'

export const gappsBuildPhases: Array<{ id: GappsBuildPhase; label: string }> = [
  { id: 'queued', label: 'Queued' },
  { id: 'pulling_base', label: 'Pull ReDroid base' },
  { id: 'resolving_sources', label: 'Resolve source revision' },
  { id: 'building_gapps', label: 'Build MindTheGapps package' },
  { id: 'validating_payload', label: 'Validate Google packages' },
  { id: 'building_image', label: 'Patch image' },
  { id: 'validating_image', label: 'Validate image metadata' },
  { id: 'complete', label: 'Complete' }
]

export const bytesToGb = (value: number) => `${(value / 1024 ** 3).toFixed(1)} GB`
