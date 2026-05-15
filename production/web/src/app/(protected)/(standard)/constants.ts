import {
  IconApps,
  IconLibraryPlusFilled,
  IconAdjustments,
  IconBrandAndroid,
  IconServerSpark
} from '@tabler/icons-react'

export const ApkProviders = [
  { value: 'manual', label: 'Manual' },
  { value: 'apk-pure', label: 'APKPure' },
  { value: 'f-droid', label: 'F-Droid' }
] as const

export interface AppDefinition {
  id: string
  name: string
  icon: string
  running: boolean
  containerName: string
  lastAccessed?: Date
  apk: {
    version: string
    newVersion?: string
    provider?: (typeof ApkProviders)[number]['value']
    apkProvidedBy?: (typeof ApkProviders)[number]['value']
  }
  container?: {
    persistentStorage?: boolean
    internetAccess?: boolean
  }
  redroid?: {
    version: string
    arguments?: string
  }
}

export const yourApps = [
  {
    id: 'uxjswa',
    name: 'Zappka',
    icon: 'zappka.png',
    running: true,
    apk: {
      version: '1.4.3',
      newVersion: '1.5.0'
    },
    containerName: 'redroid-admin-uxjswa'
  },
  {
    id: 'llsdiy',
    name: 'Decathlon',
    icon: 'decathlon.png',
    running: false,
    apk: {
      version: '2.1.0',
      newVersion: '2.4.5'
    },
    containerName: 'redroid-admin-llsdiy'
  },
  {
    id: 'gllasn',
    name: 'Rossmann',
    icon: 'rossmann.jpg',
    running: false,
    apk: {
      version: '3.0.1'
    },
    containerName: 'redroid-admin-gllasn'
  },
  {
    id: 'uuiaqd',
    name: 'Lidl Plus',
    icon: 'lidl.png',
    running: false,
    apk: {
      version: '1.2.5'
    },
    containerName: 'redroid-admin-uuiaqd'
  },
  {
    id: 'vihwqd',
    name: "McDonald's",
    icon: 'mcdonalds.png',
    running: true,
    apk: {
      version: '1.3.2'
    },
    containerName: 'redroid-admin-vihwqd'
  },
  {
    id: 'oaf8ds',
    name: 'Kaufland',
    icon: 'kaufland.png',
    running: false,
    apk: {
      version: '1.0.0'
    },
    containerName: 'redroid-admin-oaf8ds'
  },
  {
    id: 'aldfef',
    name: 'LEROY MERLIN',
    icon: 'leroy.png',
    running: false,
    apk: {
      version: '2.3.4'
    },
    containerName: 'redroid-admin-aldfef'
  },
  {
    id: 'pyflca',
    name: 'Hebe',
    icon: 'hebe.png',
    running: false,
    apk: {
      version: '8.43.1',
      newVersion: '94.1.19'
    },
    containerName: 'redroid-admin-pyflca'
  },
  {
    id: 'sdfois',
    name: 'Deichmann Footwear',
    icon: 'deichman.png',
    running: false,
    apk: {
      version: '99.0.1-prod'
    },
    containerName: 'redroid-admin-sdfois'
  },
  {
    id: 'cmisdf',
    name: 'Orlen Vitay',
    icon: 'orlen.png',
    running: true,
    apk: {
      version: '100.1.1'
    },
    containerName: 'redroid-admin-cmisdf'
  }
] as AppDefinition[]

export const appsSections = [
  { name: 'Installed Apps', Icon: IconApps, href: '/apps' },
  { name: 'Add New App', Icon: IconLibraryPlusFilled, href: '/apps/create' }
] as const

export const settingsSections = [
  { name: 'General', Icon: IconAdjustments, href: '/settings/general' },
  { name: 'Redroid', Icon: IconBrandAndroid, href: '/settings/redroid' },
  { name: 'System', Icon: IconServerSpark, href: '/settings/system' }
] as const
