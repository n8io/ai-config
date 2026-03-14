import { defineCommand } from 'citty'
import { log } from '@clack/prompts'
import { join } from 'path'
import { loadManifests } from '../lib/manifest'
import { readInstallManifest } from '../lib/install-manifest'
import { getRepoDir } from '../lib/env'

function pad(s: string, len: number): string {
  return s.padEnd(len)
}

export const listCommand = defineCommand({
  meta: { name: 'list', description: 'List available topics and their install state' },
  async run() {
    const repoDir = getRepoDir()
    const agentsDir = join(repoDir, '.agents')
    const installManifestPath = join(repoDir, '.install-manifest.json')

    const manifests = loadManifests(agentsDir)

    if (manifests.length === 0) {
      log.warn('No topics found. Repo may not be cloned yet — run `ai-config setup` first.')
      return
    }

    const installManifest = readInstallManifest(installManifestPath)

    // Build installed map: topic → Set<provider>
    const installedMap = new Map<string, Set<string>>()
    for (const record of installManifest.records) {
      if (!record.topic || !record.provider) continue
      if (!installedMap.has(record.topic)) installedMap.set(record.topic, new Set())
      installedMap.get(record.topic)!.add(record.provider)
    }

    const header = `  ${pad('Topic', 12)}${pad('Description', 47)}Installed`
    const divider = `  ${pad('─────────', 12)}${pad('─────────────────────────────────────────────', 47)}──────────────`
    console.log(header)
    console.log(divider)

    for (const m of manifests) {
      const providers = installedMap.get(m.topic)
      const installedStr = providers && providers.size > 0
        ? [...providers].sort().join(', ')
        : '—'
      const desc = m.description ?? ''
      console.log(`  ${pad(m.topic, 12)}${pad(desc, 47)}${installedStr}`)
    }
  },
})
