import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { readInstallManifest, appendInstallRecord } from '../lib/install-manifest'

let tmp: string

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'ai-config-test-'))
})

afterEach(() => {
  rmSync(tmp, { recursive: true })
})

describe('readInstallManifest', () => {
  it('returns empty records when file does not exist', () => {
    const manifest = readInstallManifest(join(tmp, 'install-manifest.json'))
    expect(manifest.records).toEqual([])
  })
})

describe('appendInstallRecord', () => {
  it('creates the file if it does not exist and appends a record', () => {
    const path = join(tmp, 'install-manifest.json')
    appendInstallRecord(path, {
      topic: 'hooks',
      provider: 'claude',
      symlinkPath: '/home/.claude/hooks/tool.sh',
      sourcePath: '/home/.ai-config/.agents/hooks/tool.sh',
      installedAt: '2026-03-14T00:00:00.000Z',
    })

    const manifest = readInstallManifest(path)
    expect(manifest.records).toHaveLength(1)
    expect(manifest.records[0].symlinkPath).toBe('/home/.claude/hooks/tool.sh')
  })

  it('appends to existing records without overwriting', () => {
    const path = join(tmp, 'install-manifest.json')
    appendInstallRecord(path, {
      topic: 'rules',
      provider: 'claude',
      symlinkPath: '/a',
      sourcePath: '/b',
      installedAt: '2026-03-14T00:00:00.000Z',
    })
    appendInstallRecord(path, {
      topic: 'hooks',
      provider: 'claude',
      symlinkPath: '/c',
      sourcePath: '/d',
      installedAt: '2026-03-14T00:00:00.000Z',
    })

    const manifest = readInstallManifest(path)
    expect(manifest.records).toHaveLength(2)
  })

  it('records backup path when provided', () => {
    const path = join(tmp, 'install-manifest.json')
    appendInstallRecord(path, {
      topic: 'hooks',
      provider: 'claude',
      symlinkPath: '/a',
      sourcePath: '/b',
      backupPath: '/a.bak.2026-03-14',
      installedAt: '2026-03-14T00:00:00.000Z',
    })

    const manifest = readInstallManifest(path)
    expect(manifest.records[0].backupPath).toBe('/a.bak.2026-03-14')
  })
})
