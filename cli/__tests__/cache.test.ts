import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { readSyncCache, writeSyncCache, isSyncCacheStale } from '../lib/cache'

let tmp: string

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'ai-config-test-'))
})

afterEach(() => {
  rmSync(tmp, { recursive: true })
})

describe('readSyncCache', () => {
  it('returns null when cache file does not exist', () => {
    expect(readSyncCache(join(tmp, '.sync-cache'))).toBeNull()
  })

  it('parses a valid cache file', () => {
    const path = join(tmp, '.sync-cache')
    writeSyncCache(path, '2026-01-01T00:00:00.000Z')
    const cache = readSyncCache(path)
    expect(cache?.lastSync).toBe('2026-01-01T00:00:00.000Z')
  })
})

describe('isSyncCacheStale', () => {
  it('returns true when cache is null (never synced)', () => {
    expect(isSyncCacheStale(null, 24)).toBe(true)
  })

  it('returns false when lastSync is less than maxAgeHours ago', () => {
    const recent = new Date(Date.now() - 1000 * 60 * 30).toISOString() // 30 min ago
    expect(isSyncCacheStale({ lastSync: recent }, 24)).toBe(false)
  })

  it('returns true when lastSync is more than maxAgeHours ago', () => {
    const old = new Date(Date.now() - 1000 * 60 * 60 * 25).toISOString() // 25 hours ago
    expect(isSyncCacheStale({ lastSync: old }, 24)).toBe(true)
  })
})

describe('writeSyncCache', () => {
  it('writes a valid JSON file', () => {
    const path = join(tmp, '.sync-cache')
    writeSyncCache(path, new Date().toISOString())
    const cache = readSyncCache(path)
    expect(cache).not.toBeNull()
  })
})
