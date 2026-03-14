import { defineCommand } from 'citty'
import { intro, outro, log, confirm, isCancel } from '@clack/prompts'
import { unlinkSync, existsSync, renameSync } from 'fs'
import { join } from 'path'
import { readInstallManifest, writeInstallManifest } from '../lib/install-manifest'
import { getRepoDir } from '../lib/env'

export const uninstallCommand = defineCommand({
  meta: { name: 'uninstall', description: 'Remove installed symlinks' },
  args: {
    yes: { type: 'boolean', description: 'Skip all confirmation prompts', default: false },
  },
  async run({ args, rawArgs }) {
    const isYes = args['yes']
    const repoDir = getRepoDir()
    const installManifestPath = join(repoDir, '.install-manifest.json')

    // Parse requested topics from positional args
    const requestedTopics = rawArgs.filter(a => !a.startsWith('-'))

    intro('ai-config uninstall')

    const manifest = readInstallManifest(installManifestPath)

    // Filter records: only v2 records with topic field, optionally filter by topic
    let toRemove = manifest.records.filter(r => r.topic && r.provider)
    if (requestedTopics.length > 0) {
      toRemove = toRemove.filter(r => requestedTopics.includes(r.topic))
    }

    if (toRemove.length === 0) {
      log.warn('Nothing to uninstall.')
      outro('Done')
      return
    }

    // Pre-deletion confirmation
    if (!isYes) {
      log.message('The following symlinks will be removed:')
      for (const r of toRemove) {
        const displayPath = r.symlinkPath.replace(process.env.HOME ?? '', '~')
        log.message(`  ${r.provider}  ${r.topic}  ${displayPath}`)
      }
      const ok = await confirm({ message: 'Remove these symlinks?' })
      if (isCancel(ok) || !ok) { outro('Cancelled'); process.exit(0) }
    }

    // Remove and optionally restore backups
    for (const record of toRemove) {
      let alreadyMissing = false
      try {
        unlinkSync(record.symlinkPath)
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          alreadyMissing = true
        } else {
          log.error(`  failed to remove  ${record.symlinkPath}: ${(err as Error).message}`)
          continue
        }
      }
      if (alreadyMissing) {
        log.info(`  already removed  ${record.symlinkPath}`)
      } else {
        log.success(`  removed  ${record.symlinkPath}`)
      }

      if (record.backupPath && existsSync(record.backupPath)) {
        if (!isYes) {
          const restore = await confirm({ message: `Restore backup at ${record.backupPath}?` })
          if (!isCancel(restore) && restore) {
            renameSync(record.backupPath, record.symlinkPath)
            log.success(`  restored  ${record.symlinkPath}`)
          } else {
            log.info(`  backup left at  ${record.backupPath}`)
          }
        } else {
          log.info(`  backup left at  ${record.backupPath}`)
        }
      }
    }

    // Update manifest
    const removeSet = new Set(toRemove.map(r => r.symlinkPath))
    const remaining = manifest.records.filter(r => !removeSet.has(r.symlinkPath))
    writeInstallManifest(installManifestPath, { records: remaining })

    outro('Uninstall complete')
  },
})
