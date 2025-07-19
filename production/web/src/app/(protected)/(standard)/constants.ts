export interface AppDefinition {
  id: string
  name: string
  icon: string
  running: boolean
  version: string
  containerName: string
  newVersion?: string
  lastAccessed?: Date
}

export const yourApps = [
  {
    id: 'uxjswa',
    name: 'Zappka',
    icon: 'zappka.png',
    running: true,
    version: '1.4.3',
    newVersion: '1.5.0',
    containerName: 'redroid-admin-uxjswa'
  },
  {
    id: 'llsdiy',
    name: 'Decathlon',
    icon: 'decathlon.png',
    running: false,
    version: '2.1.0',
    containerName: 'redroid-admin-llsdiy'
  },
  {
    id: 'gllasn',
    name: 'Rossmann',
    icon: 'rossmann.jpg',
    running: false,
    version: '3.0.1',
    containerName: 'redroid-admin-gllasn'
  },
  {
    id: 'uuiaqd',
    name: 'Lidl Plus',
    icon: 'lidl.png',
    running: false,
    version: '1.2.5',
    containerName: 'redroid-admin-uuiaqd'
  },
  {
    id: 'vihwqd',
    name: "McDonald's",
    icon: 'mcdonalds.png',
    running: true,
    version: '1.3.2',
    containerName: 'redroid-admin-vihwqd'
  },
  {
    id: 'oaf8ds',
    name: 'Kaufland',
    icon: 'kaufland.png',
    running: false,
    version: '1.0.0',
    containerName: 'redroid-admin-oaf8ds'
  },
  {
    id: 'aldfef',
    name: 'LEROY MERLIN',
    icon: 'leroy.png',
    running: false,
    version: '2.3.4',
    containerName: 'redroid-admin-aldfef'
  },
  {
    id: 'pyflca',
    name: 'Hebe',
    icon: 'hebe.png',
    running: false,
    version: '8.43.1',
    newVersion: '94.1.19',
    containerName: 'redroid-admin-pyflca'
  },
  {
    id: 'sdfois',
    name: 'Deichmann Footwear',
    icon: 'deichman.png',
    running: false,
    version: '99.0.1-prod',
    containerName: 'redroid-admin-sdfois'
  },
  {
    id: 'cmisdf',
    name: 'Orlen Vitay',
    icon: 'orlen.png',
    running: true,
    version: '100.1.1',
    containerName: 'redroid-admin-cmisdf'
  }
] as AppDefinition[]
