const repositorySegment = '[a-z0-9]+(?:(?:[._]|__|-+)[a-z0-9]+)*'
const imageName = new RegExp(
  `^${repositorySegment}(?:/${repositorySegment})*(?::[\\w][\\w.-]{0,127})?(?:@sha256:[a-f0-9]{64})?$`
)
const hostname = '[a-z0-9](?:[a-z0-9-]*[a-z0-9])?'
const registryHost = new RegExp(`^(?:${hostname}(?:\\.${hostname})*|\\[[a-f0-9:]+\\])(?::[0-9]{1,5})?$`, 'i')

export const resolveManualImageReference = (registry: string, draft: string) => {
  if (typeof draft !== 'string' || draft.length > 512) return null
  const reference = draft.trim()
  const slash = reference.indexOf('/')
  const host = slash === -1 ? '' : reference.slice(0, slash)
  const hasRegistry = host === 'localhost' || host.includes('.') || host.includes(':')

  if (registry === 'docker-hub' && !hasRegistry && imageName.test(reference)) return `docker.io/${reference}`

  if (registry === 'custom' && hasRegistry && registryHost.test(host) && imageName.test(reference.slice(slash + 1))) {
    return reference
  }

  return null
}
