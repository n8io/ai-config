import { defineCommand } from 'citty'
import { intro, outro, log, multiselect, confirm, isCancel } from '@clack/prompts'
import { join } from 'path'
import { existsSync } from 'fs'
import { loadManifests } from '../lib/manifest'
import { detectProviders, KNOWN_PROVIDERS } from '../lib/providers'
import { applyTopics } from '../lib/apply-topics'
import { writeSyncCache } from '../lib/cache'
import { readInstallManifest, writeInstallManifest } from '../lib/install-manifest'
import { HOME, DEFAULT_REPO_DIR, isLocalDevMode, getRepoDir } from '../lib/env'
import type { Provider } from '../types'

export const setupCommand = defineCommand({
  meta: { name: 'setup', description: 'Interactive guided setup for new team members' },
  args: {
    provider: { type: 'string', description: 'Target a specific provider (claude, cursor)', default: '' },
  },
  async run({ args }) {
    const repoDir = getRepoDir()
    const agentsDir = join(repoDir, '.agents')
    const syncCachePath = join(repoDir, '.sync-cache')
    const installManifestPath = join(repoDir, '.install-manifest.json')

    intro('ai-config setup')

    // Step 2: Bootstrap
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

    // Step 3: Detect/select providers
    let providers: Provider[]
    if (args.provider) {
      const found = KNOWN_PROVIDERS.find(p => p.id === args.provider)
      if (!found) {
        log.error(`Unknown provider: ${args.provider}. Known: ${KNOWN_PROVIDERS.map(p => p.id).join(', ')}`)
        process.exit(1)
      }
      providers = [found]
      log.info(`Using provider: ${found.name}`)
    } else {
      const detected = detectProviders(HOME)
      if (detected.length === 0) {
        log.warn('No supported AI tools detected. Install Claude Code or Cursor first.')
        outro('Nothing to set up')
        return
      }
      if (detected.length === 1) {
        providers = detected
        log.info(`Detected: ${detected[0].name}`)
      } else {
        const chosen = await multiselect({
          message: 'Which AI tools do you use?',
          options: detected.map(p => ({ value: p.id, label: p.name })),
          initialValues: detected.map(p => p.id),
        })
        if (isCancel(chosen)) { outro('Cancelled'); process.exit(0) }
        providers = KNOWN_PROVIDERS.filter(p => (chosen as string[]).includes(p.id))
      }
    }

    // Step 4: Topic selection
    const allManifests = loadManifests(agentsDir)
    if (allManifests.length === 0) {
      log.warn('No topics found in .agents/.')
      outro('Nothing to install')
      return
    }

    const chosenTopics = await multiselect({
      message: 'Which topics do you want to install?',
      options: allManifests.map(m => ({
        value: m.topic,
        label: m.topic,
        hint: m.description,
      })),
      initialValues: allManifests.map(m => m.topic),
    })
    if (isCancel(chosenTopics)) { outro('Cancelled'); process.exit(0) }
    const manifests = allManifests.filter(m => (chosenTopics as string[]).includes(m.topic))
    if (manifests.length === 0) { outro('No topics selected'); process.exit(0) }

    // Step 5: Dry-run preview
    log.step('Previewing changes...')
    const preview = await applyTopics(manifests, providers, repoDir, {
      dryRun: true,
      verbose: false,
      conflictStrategy: 'backup',
    })

    let hasChanges = false
    let lastTopic = ''
    for (const r of preview) {
      if (!r.target) continue
      if (r.topic !== lastTopic) {
        log.message(`  [${r.topic}]`)
        lastTopic = r.topic
      }
      if (r.status === 'would-create') {
        log.info(`    would link  ${r.target} → ${r.src}`)
        hasChanges = true
      } else if (r.status === 'would-conflict') {
        log.warn(`    would backup + replace  ${r.target}`)
        hasChanges = true
      }
    }

    if (!hasChanges) {
      log.info('Everything already up to date.')
      outro('Nothing to do')
      return
    }

    // Step 6: Confirm
    const ok = await confirm({ message: 'Apply these changes?' })
    if (isCancel(ok) || !ok) { outro('Cancelled'); process.exit(0) }

    // Step 7: Apply
    const results = await applyTopics(manifests, providers, repoDir, {
      dryRun: false,
      verbose: false,
      conflictStrategy: 'backup',
    })

    for (const r of results) {
      if (r.status === 'linked') log.success(`  linked  ${r.target}`)
      else if (r.status === 'backed-up') log.success(`  linked  ${r.target}  (backup: ${r.backupPath})`)
      else if (r.status === 'error') log.error(`  failed  ${r.target}: ${r.error}`)
    }

    const newRecords = results.filter(r => r.record).map(r => r.record!)
    if (newRecords.length > 0) {
      const existing = readInstallManifest(installManifestPath)
      writeInstallManifest(installManifestPath, { records: [...existing.records, ...newRecords] })
      writeSyncCache(syncCachePath, new Date().toISOString())
    }

    outro("Setup complete. Run `ai-config update` to sync future changes.")
  },
})
