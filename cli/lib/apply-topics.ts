import { copyFileSync, unlinkSync } from 'fs'
import { select, confirm, isCancel, log } from '@clack/prompts'
import { spawnSync } from 'child_process'
import { planSymlink, applySymlink } from './symlink'
import { resolveTarget } from './paths'
import { join } from 'path'
import type { Manifest, Provider, InstallRecord, ApplyResult } from '../types'

function makeBackupPath(target: string): string {
  return `${target}.bak.${new Date().toISOString().replace(/[:.]/g, '-')}`
}

function backupAndLink(src: string, target: string): string {
  const backupPath = makeBackupPath(target)
  copyFileSync(target, backupPath)
  try { unlinkSync(target) } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
  }
  applySymlink(src, target)
  return backupPath
}

export async function applyTopics(
  manifests: Manifest[],
  providers: Provider[],
  repoDir: string,
  options: {
    dryRun: boolean
    verbose: boolean
    conflictStrategy: 'ask' | 'skip' | 'backup' | 'overwrite'
  }
): Promise<ApplyResult[]> {
  const results: ApplyResult[] = []

  for (const manifest of manifests) {
    const topicDir = join(repoDir, '.agents', manifest.topic)
    for (const file of manifest.files) {
      for (const provider of providers) {
        const targetTemplate = file.targets[provider.id]

        // null target means this provider doesn't support this file
        if (targetTemplate === null || targetTemplate === undefined) {
          results.push({ status: 'skipped', src: join(topicDir, file.src), target: '', topic: manifest.topic, provider: provider.id })
          continue
        }

        const src = join(topicDir, file.src)
        const target = resolveTarget(targetTemplate)
        const plan = planSymlink(src, target, repoDir)

        if (plan.status === 'skip-already-linked') {
          if (options.verbose) log.info(`  skip (already linked)  ${target}`)
          results.push({ status: 'skipped', src, target, topic: manifest.topic, provider: provider.id })
          continue
        }

        if (plan.status === 'create') {
          if (options.dryRun) {
            results.push({ status: 'would-create', src, target, topic: manifest.topic, provider: provider.id })
            continue
          }
          try {
            applySymlink(src, target)
            const record: InstallRecord = { topic: manifest.topic, provider: provider.id, symlinkPath: target, sourcePath: src, installedAt: new Date().toISOString() }
            results.push({ status: 'linked', src, target, topic: manifest.topic, provider: provider.id, record })
          } catch (err) {
            results.push({ status: 'error', src, target, topic: manifest.topic, provider: provider.id, error: (err as Error).message })
          }
          continue
        }

        // conflict
        if (options.dryRun) {
          results.push({ status: 'would-conflict', src, target, topic: manifest.topic, provider: provider.id })
          continue
        }

        if (options.conflictStrategy === 'skip') {
          results.push({ status: 'skipped', src, target, topic: manifest.topic, provider: provider.id })
          continue
        }

        if (options.conflictStrategy === 'backup') {
          try {
            const backupPath = backupAndLink(src, target)
            const record: InstallRecord = { topic: manifest.topic, provider: provider.id, symlinkPath: target, sourcePath: src, backupPath, installedAt: new Date().toISOString() }
            results.push({ status: 'backed-up', src, target, topic: manifest.topic, provider: provider.id, record, backupPath })
          } catch (err) {
            results.push({ status: 'error', src, target, topic: manifest.topic, provider: provider.id, error: (err as Error).message })
          }
          continue
        }

        if (options.conflictStrategy === 'overwrite') {
          try {
            try { unlinkSync(target) } catch (e) {
              if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
            }
            applySymlink(src, target)
            const record: InstallRecord = { topic: manifest.topic, provider: provider.id, symlinkPath: target, sourcePath: src, installedAt: new Date().toISOString() }
            results.push({ status: 'linked', src, target, topic: manifest.topic, provider: provider.id, record })
          } catch (err) {
            results.push({ status: 'error', src, target, topic: manifest.topic, provider: provider.id, error: (err as Error).message })
          }
          continue
        }

        // 'ask' strategy — interactive
        const action = await select({
          message: `${target} already exists`,
          options: [
            { value: 'skip', label: 'Skip' },
            { value: 'overwrite', label: 'Overwrite' },
            { value: 'backup', label: 'Backup & replace' },
            { value: 'diff', label: 'Show diff (then decide)' },
          ],
        })

        if (isCancel(action) || action === 'skip') {
          results.push({ status: 'skipped', src, target, topic: manifest.topic, provider: provider.id })
          continue
        }

        if (action === 'diff') {
          spawnSync('diff', [target, src], { stdio: 'inherit' })
          const ok = await confirm({ message: 'Overwrite?' })
          if (isCancel(ok) || !ok) {
            results.push({ status: 'skipped', src, target, topic: manifest.topic, provider: provider.id })
            continue
          }
        }

        try {
          if (action === 'backup' || action === 'diff') {
            const backupPath = backupAndLink(src, target)
            const record: InstallRecord = { topic: manifest.topic, provider: provider.id, symlinkPath: target, sourcePath: src, backupPath, installedAt: new Date().toISOString() }
            results.push({ status: 'backed-up', src, target, topic: manifest.topic, provider: provider.id, record, backupPath })
          } else {
            try { unlinkSync(target) } catch (e) {
              if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
            }
            applySymlink(src, target)
            const record: InstallRecord = { topic: manifest.topic, provider: provider.id, symlinkPath: target, sourcePath: src, installedAt: new Date().toISOString() }
            results.push({ status: 'linked', src, target, topic: manifest.topic, provider: provider.id, record })
          }
        } catch (err) {
          results.push({ status: 'error', src, target, topic: manifest.topic, provider: provider.id, error: (err as Error).message })
        }
      }
    }
  }

  return results
}
