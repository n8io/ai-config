import { readFileSync, writeFileSync } from 'fs'
import type { SyncCache } from '../types'

export function readSyncCache(cachePath: string): SyncCache | null {
  try {
    return JSON.parse(readFileSync(cachePath, 'utf-8')) as SyncCache
  } catch {
    return null
  }
}

export function writeSyncCache(cachePath: string, timestamp: string): void {
  const cache: SyncCache = { lastSync: timestamp }
  writeFileSync(cachePath, JSON.stringify(cache, null, 2))
}

export function isSyncCacheStale(cache: SyncCache | null, maxAgeHours: number): boolean {
  if (!cache) return true
  const lastSync = new Date(cache.lastSync).getTime()
  const ageMs = Date.now() - lastSync
  return ageMs > maxAgeHours * 60 * 60 * 1000
}
