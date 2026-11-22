import { DEFAULT_AUTOMATION_TAG_COLOR, type AutomationTag } from '@rebroid/automation-core/definition'

export const isHexColor = (value: string) => /^#[0-9a-fA-F]{6}$/.test(value.trim())

const normalizeTagColor = (value: string) =>
  isHexColor(value) ? value.trim().toLowerCase() : DEFAULT_AUTOMATION_TAG_COLOR

export const createAutomationTag = (name: string, color: string = DEFAULT_AUTOMATION_TAG_COLOR): AutomationTag => ({
  name: name.trim(),
  color: normalizeTagColor(color)
})

export function automationTagStyle(hex: string) {
  const backgroundColor = normalizeTagColor(hex)
  const normalized = backgroundColor.slice(1)
  const red = Number.parseInt(normalized.slice(0, 2), 16)
  const green = Number.parseInt(normalized.slice(2, 4), 16)
  const blue = Number.parseInt(normalized.slice(4, 6), 16)
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255
  return { backgroundColor, color: luminance > 0.62 ? '#111827' : '#f8fafc' }
}

export function buildAutomationTagCatalog(names: string[], tags: AutomationTag[]) {
  const byName = new Map<string, AutomationTag>()
  for (const tag of [...tags, ...names.map(name => createAutomationTag(name))]) {
    const key = tag.name.trim().toLocaleLowerCase()
    if (key && !byName.has(key)) byName.set(key, tag)
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
}
