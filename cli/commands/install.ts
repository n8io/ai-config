import { defineCommand } from 'citty'
import { intro, outro, log } from '@clack/prompts'
import { join } from 'path'
import { existsSync } from 'fs'
import { loadManifests } from '../lib/manifest'
import { detectProviders, KNOWN_PROVIDERS } from '../lib/providers'
import { applyTopics } from '../lib/apply-topics'
import { writeSyncCache } from '../lib/cache'
import { readInstallManifest, writeInstallManifest } from '../lib/install-manifest'
import { HOME, DEFAULT_REPO_DIR, isLocalDevMode, getRepoDir } from '../lib/env'
import type { Provider } from '../types'

export const installCommand = defineCommand({
  meta: { name: 'install', description: 'Install AI config via symlinks' },
  args: {
    provider: { type: 'string', description: 'Target a specific provider (claude, cursor)', default: '' },
    'dry-run': { type: 'boolean', description: 'Preview changes without applying', default: false },
    yes: { type: 'boolean', description: 'Skip conflict prompts (use safe defaults)', default: false },
    verbose: { type: 'boolean', description: 'Show all symlink operations including skipped', default: false },
  },
  async run({ args, rawArgs }) {
    const isDryRun = args['dry-run']
    const isYes = args['yes']
    const isVerbose = args['verbose']
    const repoDir = getRepoDir()
    const agentsDir = join(repoDir, '.agents')
    const syncCachePath = join(repoDir, '.sync-cache')
    const installManifestPath = join(repoDir, '.install-manifest.json')

    intro('ai-config install')

    // Bootstrap
    if (!isLocalDevMode()) {
      if (existsSync(DEFAULT_REPO_DIR)) {
        if (!existsSync(join(DEFAULT_REPO_DIR, '.git'))) {
          log.error(`${DEFAULT_REPO_DIR} exists but is not a git repository. Remove it and re-run.`)
          process.exit(1)
        }
      } else {
        log.step(`Cloning ai-config repo to ${DEFAULT_REPO_DIR}...`)
        const { cloneRepo } = await import('../lib/repo')
        try {
          cloneRepo(DEFAULT_REPO_DIR)
          log.success('Cloned successfully')
        } catch (err) {
          log.error(`Clone failed: ${(err as Error).message}`)
          process.exit(1)
        }
      }
    }

    if (!existsSync(agentsDir)) {
      log.error(`No .agents/ directory found at ${repoDir}.`)
      process.exit(1)
    }

    // Determine providers
    let providers: Provider[]
    if (args.provider) {
      const found = KNOWN_PROVIDERS.find(p => p.id === args.provider)
      if (!found) {
        log.error(`Unknown provider: ${args.provider}. Known: ${KNOWN_PROVIDERS.map(p => p.id).join(', ')}`)
        process.exit(1)
      }
      providers = [found]
    } else {
      providers = detectProviders(HOME)
      if (providers.length === 0) {
        log.warn('No supported providers detected. Nothing to install.')
        outro('Done')
        return
      }
    }

    // Parse requested topics from positional args
    const requestedTopics = rawArgs.filter((a, i, arr) => {
      if (a.startsWith('-')) return false
      if (arr[i - 1] === '--provider') return false
      return true
    })

    // Load and filter manifests
    const allManifests = loadManifests(agentsDir)
    const knownTopics = allManifests.map(m => m.topic)

    let manifests = allManifests
    if (requestedTopics.length > 0) {
      for (const t of requestedTopics) {
        if (!knownTopics.includes(t)) {
          log.warn(`No manifest found for topic "${t}". Available: ${knownTopics.join(', ')}`)
        }
      }
      manifests = allManifests.filter(m => requestedTopics.includes(m.topic))
    }

    const conflictStrategy = isDryRun ? 'skip' : isYes ? 'skip' : 'ask'
    const results = await applyTopics(manifests, providers, repoDir, {
      dryRun: isDryRun,
      verbose: isVerbose,
      conflictStrategy,
    })

    for (const r of results) {
      if (r.status === 'linked') log.success(`  linked  ${r.target}`)
      else if (r.status === 'backed-up') log.success(`  linked  ${r.target}  (backup: ${r.backupPath})`)
      else if (r.status === 'would-create') log.info(`  would create  ${r.target} → ${r.src}`)
      else if (r.status === 'would-conflict') log.warn(`  conflict  ${r.target}  (already exists)`)
      else if (r.status === 'error') log.error(`  failed  ${r.target}: ${r.error}`)
      else if (r.status === 'skipped' && isVerbose && r.target) log.info(`  skip  ${r.target}`)
    }

    if (!isDryRun) {
      const newRecords = results.filter(r => r.record).map(r => r.record!)
      if (newRecords.length > 0) {
        const existing = readInstallManifest(installManifestPath)
        writeInstallManifest(installManifestPath, { records: [...existing.records, ...newRecords] })
        writeSyncCache(syncCachePath, new Date().toISOString())
      }
    }

    outro(isDryRun ? 'Dry run complete' : 'Install complete')
  },
})
