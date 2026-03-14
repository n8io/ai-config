import { defineCommand } from 'citty'
import { log } from '@clack/prompts'
import { lstatSync, readlinkSync, existsSync } from 'fs'
import { join } from 'path'
import { readInstallManifest } from '../lib/install-manifest'
import { readSyncCache } from '../lib/cache'
import { loadManifests } from '../lib/manifest'
import { getRepoDir } from '../lib/env'
import type { InstallRecord } from '../types'

type SymlinkState = '✓ linked' | '✗ broken' | '! conflict' | '- missing'

function checkSymlink(record: InstallRecord): SymlinkState {
  // Pre-v2 records without topic/provider treated as missing
  if (!record.topic || !record.provider) return '- missing'
  try {
    const stat = lstatSync(record.symlinkPath)
    if (!stat.isSymbolicLink()) return '! conflict'
    const resolved = readlinkSync(record.symlinkPath)
    if (resolved !== record.sourcePath) return '! conflict'
    return existsSync(record.sourcePath) ? '✓ linked' : '✗ broken'
  } catch {
    return '- missing'
  }
}

function pad(s: string, len: number): string {
  return s.padEnd(len)
}

export const statusCommand = defineCommand({
  meta: { name: 'status', description: 'Show installed symlinks and their health' },
  async run() {
    const repoDir = getRepoDir()
    const installManifestPath = join(repoDir, '.install-manifest.json')
    const syncCachePath = join(repoDir, '.sync-cache')
    const agentsDir = join(repoDir, '.agents')

    const manifest = readInstallManifest(installManifestPath)
    const records = manifest.records

    if (records.length === 0) {
      log.info('Nothing installed yet. Run `ai-config setup` to get started.')
      process.exit(0)
    }

    // Header
    const header = `  ${pad('Provider', 10)}${pad('Topic', 12)}${pad('File', 42)}State`
    const divider = `  ${pad('─────────', 10)}${pad('─────────', 12)}${pad('───────────────────────────────────────────', 42)}──────────`
    console.log(header)
    console.log(divider)

    let hasUnhealthy = false
    for (const record of records) {
      const state = checkSymlink(record)
      if (state !== '✓ linked') hasUnhealthy = true

      // Shorten path for display (~/ prefix)
      const displayPath = record.symlinkPath.replace(process.env.HOME ?? '', '~')
      const line = `  ${pad(record.provider ?? '?', 10)}${pad(record.topic ?? '?', 12)}${pad(displayPath, 42)}${state}`
      console.log(line)
    }

    // Last synced
    console.log('')
    const syncCache = readSyncCache(syncCachePath)
    if (syncCache) {
      const date = new Date(syncCache.lastSync)
      console.log(`  Last synced: ${date.toLocaleString()}`)
    } else {
      console.log('  Last synced: Never')
    }

    // Not installed
    const installedTopics = new Set(records.filter(r => r.topic).map(r => r.topic))
    const availableManifests = loadManifests(agentsDir)
    const notInstalled = availableManifests.map(m => m.topic).filter(t => !installedTopics.has(t))
    if (notInstalled.length > 0) {
      console.log(`\n  Not installed: ${notInstalled.join(', ')}`)
    }

    process.exit(hasUnhealthy ? 1 : 0)
  },
})
