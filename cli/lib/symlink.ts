import { existsSync, lstatSync, readlinkSync, symlinkSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import type { SymlinkPlan, InstallRecord } from '../types'

export function planSymlink(src: string, target: string, repoDir: string): SymlinkPlan {
  // lstatSync does NOT follow symlinks, so it succeeds even for broken symlinks.
  // If it throws, the target truly doesn't exist.
  let stat
  try {
    stat = lstatSync(target)
  } catch {
    return { src, target, status: 'create' }
  }

  if (stat.isSymbolicLink()) {
    const resolved = readlinkSync(target)
    if (resolved.startsWith(repoDir)) {
      return { src, target, status: 'skip-already-linked' }
    }
    // Symlink pointing outside repo — includes broken symlinks pointing elsewhere
    return { src, target, status: 'conflict' }
  }

  // Regular file or directory
  return { src, target, status: 'conflict' }
}

export function applySymlink(src: string, target: string): void {
  mkdirSync(dirname(target), { recursive: true })
  symlinkSync(src, target)
}

export function verifySymlinks(records: Pick<InstallRecord, 'symlinkPath' | 'sourcePath'>[]): typeof records {
  return records.filter(r => {
    try {
      const stat = lstatSync(r.symlinkPath)
      if (!stat.isSymbolicLink()) return true        // not a symlink — needs attention
      const resolved = readlinkSync(r.symlinkPath)
      if (resolved !== r.sourcePath) return true     // points somewhere else
      return !existsSync(r.symlinkPath)              // source file gone (broken symlink)
    } catch {
      return true // symlink or source missing
    }
  })
}
