export interface AppDefinition {
  id: string;
  name: string;
  icon: string;
  running: boolean;
}

export const yourApps = [
  { id: 'uxjswa', name: 'Zappka', icon: 'zappka.png', running: true },
  { id: 'llsdiy', name: 'Decathlon', icon: 'decathlon.png', running: false },
  { id: 'gllasn', name: 'Rossmann', icon: 'rossmann.jpg', running: false },
  { id: 'uuiaqd', name: 'Lidl Plus', icon: 'lidl.png', running: false },
  { id: 'vihwqd', name: "McDonald's", icon: 'mcdonalds.png', running: true },
  { id: 'oaf8ds', name: 'Kaufland', icon: 'kaufland.png', running: false },
  { id: 'aldfef', name: 'LEROY MERLIN', icon: 'leroy.png', running: false },
  { id: 'pyflca', name: 'Hebe', icon: 'hebe.png', running: false },
  { id: 'sdfois', name: 'Deichmann Footwear', icon: 'deichman.png', running: false },
  { id: 'cmisdf', name: 'Orlen Vitay', icon: 'orlen.png', running: true }
] as AppDefinition[]