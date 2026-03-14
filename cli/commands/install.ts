import { defineCommand } from 'citty'
import { intro, outro, log, select, confirm, isCancel } from '@clack/prompts'
import { join, resolve } from 'path'
import { homedir } from 'os'
import { existsSync, lstatSync, readFileSync, copyFileSync, unlinkSync } from 'fs'
import { loadManifests } from '../lib/manifest'
import { detectProviders, KNOWN_PROVIDERS } from '../lib/providers'
import { planSymlink, applySymlink } from '../lib/symlink'
import { resolveTarget } from '../lib/paths'
import { writeSyncCache } from '../lib/cache'
import { readInstallManifest, writeInstallManifest } from '../lib/install-manifest'
import type { Provider, InstallRecord } from '../types'

const HOME = homedir()
const DEFAULT_REPO_DIR = join(HOME, '.ai-config')

/**
 * Detect if running directly from the source repo (bun run cli).
 * Checks that CWD has both a package.json named @n8io/ai-config AND a .git directory.
 * Running via bunx/npx from inside the repo does NOT trigger this — those executions
 * spawn a separate process whose CWD is not necessarily the repo root.
 */
function isLocalDevMode(): boolean {
  try {
    const cwd = process.cwd()
    const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf-8')) as { name?: string }
    return pkg.name === '@n8io/ai-config' && existsSync(join(cwd, '.git'))
  } catch {
    return false
  }
}

function getRepoDir(): string {
  return isLocalDevMode() ? process.cwd() : DEFAULT_REPO_DIR
}

export const installCommand = defineCommand({
  meta: { name: 'install', description: 'Install AI config via symlinks' },
  args: {
    provider: { type: 'string', description: 'Target a specific provider (claude, cursor)', default: '' },
    'dry-run': { type: 'boolean', description: 'Preview changes without applying', default: false },
  },
  async run({ args, rawArgs }) {
    const isDryRun = args['dry-run']
    const isInteractive = process.stdin.isTTY && !isDryRun
    const repoDir = getRepoDir()
    const agentsDir = join(repoDir, '.agents')
    // State files live inside the repo dir (works for both local dev and ~/.ai-config)
    const syncCachePath = join(repoDir, '.sync-cache')
    const installManifestPath = join(repoDir, '.install-manifest.json')

    intro('ai-config install')

    // Bootstrap: ensure repo is present (clone if needed)
    if (!isLocalDevMode()) {
      if (existsSync(DEFAULT_REPO_DIR)) {
        if (!existsSync(join(DEFAULT_REPO_DIR, '.git'))) {
          log.error(`${DEFAULT_REPO_DIR} exists but is not a git repository. Remove it and re-run.`)
          process.exit(1)
        }
        // Already cloned — use existing
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

    // Filter topics from rawArgs (positional args after the subcommand name).
    // Skip flags (--dry-run) and their values (value immediately after --provider).
    const requestedTopics = rawArgs.filter((a, i, arr) => {
      if (a.startsWith('-')) return false
      if (arr[i - 1] === '--provider') return false  // skip --provider's value
      return true
    })

    // Load manifests
    const manifests = loadManifests(agentsDir)
    const filteredManifests = requestedTopics.length > 0
      ? manifests.filter(m => requestedTopics.includes(m.topic))
      : manifests

    const installedRecords: InstallRecord[] = []

    for (const manifest of filteredManifests) {
      const topicDir = join(agentsDir, manifest.topic)
      for (const file of manifest.files) {
        for (const provider of providers) {
          const targetTemplate = file.targets[provider.id]
          if (!targetTemplate) continue

          const src = resolve(topicDir, file.src)
          const target = resolveTarget(targetTemplate)
          const plan = planSymlink(src, target, repoDir)

          if (plan.status === 'skip-already-linked' || plan.status === 'skip-null') {
            log.info(`  skip  ${target}`)
            continue
          }

          if (plan.status === 'create') {
            if (isDryRun) {
              log.info(`  would create  ${target} → ${src}`)
              continue
            }
            try {
              applySymlink(src, target)
              log.success(`  linked  ${target}`)
              installedRecords.push({ symlinkPath: target, sourcePath: src, installedAt: new Date().toISOString() })
            } catch (err) {
              log.error(`  failed  ${target}: ${(err as Error).message}`)
            }
            continue
          }

          // Conflict
          if (isDryRun) {
            log.warn(`  conflict  ${target} (already exists)`)
            continue
          }

          if (!isInteractive) {
            log.warn(`  skip (conflict)  ${target} — already exists, resolve manually`)
            continue
          }

          const action = await select({
            message: `${target} already exists`,
            options: [
              { value: 'skip', label: 'Skip' },
              { value: 'overwrite', label: 'Overwrite' },
              { value: 'backup', label: 'Backup & replace' },
              { value: 'diff', label: 'Show diff (then decide)' },
            ],
          })

          if (isCancel(action)) { outro('Cancelled'); process.exit(0) }

          if (action === 'skip') { log.info(`  skipped  ${target}`); continue }

          if (action === 'diff') {
            const { spawnSync } = await import('child_process')
            spawnSync('diff', [target, src], { stdio: 'inherit' })
            const confirm2 = await confirm({ message: 'Overwrite?' })
            if (isCancel(confirm2) || !confirm2) { log.info(`  skipped  ${target}`); continue }
          }

          let backupPath: string | undefined
          if (action === 'backup' || action === 'diff') {
            backupPath = `${target}.bak.${new Date().toISOString().replace(/[:.]/g, '-')}`
            try { lstatSync(target) } catch { backupPath = undefined }
            if (backupPath) copyFileSync(target, backupPath)
          }

          try {
            try {
              unlinkSync(target)
            } catch (err) {
              if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
            }
            applySymlink(src, target)
            log.success(`  linked  ${target}${backupPath ? ` (backup: ${backupPath})` : ''}`)
            installedRecords.push({
              symlinkPath: target,
              sourcePath: src,
              backupPath,
              installedAt: new Date().toISOString(),
            })
          } catch (err) {
            log.error(`  failed  ${target}: ${(err as Error).message}${backupPath ? ` (backup at ${backupPath})` : ''}`)
          }
        }
      }
    }

    if (!isDryRun && installedRecords.length > 0) {
      const existing = readInstallManifest(installManifestPath)
      writeInstallManifest(installManifestPath, { records: [...existing.records, ...installedRecords] })
      writeSyncCache(syncCachePath, new Date().toISOString())
    }

    outro(isDryRun ? 'Dry run complete' : 'Install complete')
  },
})
