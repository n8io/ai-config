import { defineCommand } from 'citty'
import { intro, outro, log } from '@clack/prompts'
import { unlinkSync } from 'fs'
import { getRepoDir } from '../lib/env'
import { join } from 'path'
import { applySymlink, verifySymlinks } from '../lib/symlink'
import { writeSyncCache } from '../lib/cache'
import { readInstallManifest } from '../lib/install-manifest'
import { pullRepoOrThrow, GitError } from '../lib/repo'

export const updateCommand = defineCommand({
  meta: { name: 'update', description: 'Pull latest config and re-apply symlinks' },
  async run() {
    intro('ai-config update')

    const repoDir = getRepoDir()
    const syncCachePath = join(repoDir, '.sync-cache')
    const installManifestPath = join(repoDir, '.install-manifest.json')

    log.step('Pulling latest from origin/main...')
    try {
      pullRepoOrThrow(repoDir)
    } catch (err) {
      const msg = err instanceof GitError ? err.stderr || err.message : (err as Error).message
      log.error(`Pull failed: ${msg}`)
      process.exit(1)
    }
    log.success('Pulled latest changes')

    log.step('Verifying symlinks...')
    const installManifest = readInstallManifest(installManifestPath)
    const broken = verifySymlinks(installManifest.records)

    if (broken.length === 0) {
      log.info('All symlinks intact')
    } else {
      for (const record of broken) {
        try {
          // Unlink first — the symlink may point to a wrong target (EEXIST without this)
          try { unlinkSync(record.symlinkPath) } catch (err) {
            if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
          }
          applySymlink(record.sourcePath, record.symlinkPath)
          log.success(`  re-linked  ${record.symlinkPath}`)
        } catch (err) {
          log.error(`  failed to re-link  ${record.symlinkPath}: ${(err as Error).message}`)
        }
      }
    }

    writeSyncCache(syncCachePath, new Date().toISOString())
    outro('Update complete')
  },
})
