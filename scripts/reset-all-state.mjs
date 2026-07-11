import { execFileSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve } from 'node:path'

const execute = process.argv.includes('--execute')
const root = resolve(new URL('..', import.meta.url).pathname)
const localStatePaths = [
  resolve(root, 'apps/web/data'),
  resolve(root, 'apps/orchestrator/data'),
  resolve(root, 'apps/orchestrator/uploads')
]

const dockerOutput = args => {
  try {
    return execFileSync('docker', args, { encoding: 'utf8' })
      .split(/\s+/)
      .map(value => value.trim())
      .filter(Boolean)
  } catch (error) {
    if (!execute) return []
    throw new Error(`Docker resource discovery failed: ${error instanceof Error ? error.message : 'unknown error'}`)
  }
}

const activeContainers = dockerOutput([
  'container',
  'ls',
  '--quiet',
  '--filter',
  'name=rebroid-'
])

if (execute && activeContainers.length > 0) {
  throw new Error('Rebroid containers are still running. Stop the complete stack before resetting state.')
}

const assertSafePath = path => {
  if (path === '/' || path === homedir() || path === root || !path.startsWith(`${root}/`)) {
    throw new Error(`Refusing to remove unsafe path: ${path}`)
  }
}

for (const path of localStatePaths) {
  assertSafePath(path)
  console.log(`${execute ? 'Removing' : 'Would remove'} ${path}`)
  if (execute) rmSync(path, { recursive: true, force: true })
}

const composeVolumeNames = new Set([
  'orchestrator-data',
  'orchestrator-uploads',
  'web-data',
  'shared-secrets',
  'firewall-agent-run'
])
const volumes = dockerOutput(['volume', 'ls', '--format', '{{.Name}}']).filter(name => {
  return composeVolumeNames.has(name) || [...composeVolumeNames].some(volume => name.endsWith(`_${volume}`))
})
const managedContainers = dockerOutput([
  'container',
  'ls',
  '--all',
  '--quiet',
  '--filter',
  'label=com.rebroid.managed=true'
])
const managedNetworks = dockerOutput([
  'network',
  'ls',
  '--quiet',
  '--filter',
  'label=com.rebroid.managed=true'
])
const managedVolumes = dockerOutput([
  'volume',
  'ls',
  '--quiet',
  '--filter',
  'label=com.rebroid.managed=true'
])

const removeResources = (noun, ids, extra = []) => {
  if (ids.length === 0) return
  console.log(`${execute ? 'Removing' : 'Would remove'} Docker ${noun}: ${ids.join(', ')}`)
  if (execute) execFileSync('docker', [noun, 'rm', ...extra, ...ids], { stdio: 'inherit' })
}

removeResources('container', managedContainers, ['--force'])
removeResources('network', managedNetworks)
removeResources('volume', [...new Set([...volumes, ...managedVolumes])], ['--force'])

if (!execute) {
  console.log('Dry run only. Stop the complete Rebroid stack, review this list, then re-run with --execute.')
}
