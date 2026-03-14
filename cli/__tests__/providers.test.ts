import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { detectProviders, KNOWN_PROVIDERS } from '../lib/providers'

let tmp: string

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'ai-config-test-'))
})

afterEach(() => {
  rmSync(tmp, { recursive: true })
})

describe('detectProviders', () => {
  it('detects claude when ~/.claude/settings.json exists', () => {
    const claudeDir = join(tmp, '.claude')
    mkdirSync(claudeDir)
    writeFileSync(join(claudeDir, 'settings.json'), '{}')

    const providers = detectProviders(tmp)
    expect(providers.map(p => p.id)).toContain('claude')
  })

  it('detects cursor when ~/.cursor/ exists', () => {
    mkdirSync(join(tmp, '.cursor'))

    const providers = detectProviders(tmp)
    expect(providers.map(p => p.id)).toContain('cursor')
  })

  it('detects both providers simultaneously', () => {
    const claudeDir = join(tmp, '.claude')
    mkdirSync(claudeDir)
    writeFileSync(join(claudeDir, 'settings.json'), '{}')
    mkdirSync(join(tmp, '.cursor'))

    const providers = detectProviders(tmp)
    expect(providers).toHaveLength(2)
  })

  it('returns empty array when no providers detected', () => {
    const providers = detectProviders(tmp)
    expect(providers).toEqual([])
  })
})

describe('KNOWN_PROVIDERS', () => {
  it('includes claude and cursor', () => {
    const ids = KNOWN_PROVIDERS.map(p => p.id)
    expect(ids).toContain('claude')
    expect(ids).toContain('cursor')
  })
})
