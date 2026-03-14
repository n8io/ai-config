import { defineCommand } from 'citty'
import { intro, outro, log } from '@clack/prompts'
import { join } from 'path'
import { homedir } from 'os'
import { applySymlink, verifySymlinks } from '../lib/symlink'
import { writeSyncCache } from '../lib/cache'
import { readInstallManifest } from '../lib/install-manifest'
import { pullRepoOrThrow } from '../lib/repo'

const HOME = homedir()
const REPO_DIR = join(HOME, '.ai-config')
const SYNC_CACHE_PATH = join(REPO_DIR, '.sync-cache')
const INSTALL_MANIFEST_PATH = join(REPO_DIR, '.install-manifest.json')

export const updateCommand = defineCommand({
  meta: { name: 'update', description: 'Pull latest config and re-apply symlinks' },
  async run() {
    intro('ai-config update')

    log.step('Pulling latest from origin/main...')
    pullRepoOrThrow(REPO_DIR) // throws GitError on failure → exits with error
    log.success('Pulled latest changes')

    log.step('Verifying symlinks...')
    const installManifest = readInstallManifest(INSTALL_MANIFEST_PATH)
    const broken = verifySymlinks(installManifest.records)

    if (broken.length === 0) {
      log.info('All symlinks intact')
    } else {
      for (const record of broken) {
        applySymlink(record.sourcePath, record.symlinkPath)
        log.success(`  re-linked  ${record.symlinkPath}`)
      }
    }

    writeSyncCache(SYNC_CACHE_PATH, new Date().toISOString())
    outro('Update complete')
  },
})
