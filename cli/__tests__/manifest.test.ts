import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { loadManifests, loadManifest } from '../lib/manifest'

let tmp: string

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'ai-config-test-'))
})

afterEach(() => {
  rmSync(tmp, { recursive: true })
})

describe('loadManifest', () => {
  it('parses a valid manifest', () => {
    const dir = join(tmp, 'hooks')
    mkdirSync(dir)
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify({
      topic: 'hooks',
      files: [
        { src: 'tool-guard.sh', targets: { claude: '~/.claude/hooks/tool-guard.sh', cursor: null } }
      ]
    }))

    const manifest = loadManifest(dir)
    expect(manifest.topic).toBe('hooks')
    expect(manifest.files).toHaveLength(1)
    expect(manifest.files[0].src).toBe('tool-guard.sh')
    expect(manifest.files[0].targets.claude).toBe('~/.claude/hooks/tool-guard.sh')
    expect(manifest.files[0].targets.cursor).toBeNull()
  })

  it('throws if manifest.json is missing', () => {
    const dir = join(tmp, 'empty')
    mkdirSync(dir)
    expect(() => loadManifest(dir)).toThrow()
  })

  it('throws if topic is missing', () => {
    const dir = join(tmp, 'bad')
    mkdirSync(dir)
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ files: [] }))
    expect(() => loadManifest(dir)).toThrow(/topic/)
  })

  it('throws if files is missing', () => {
    const dir = join(tmp, 'bad2')
    mkdirSync(dir)
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ topic: 'hooks' }))
    expect(() => loadManifest(dir)).toThrow(/files/)
  })

  it('throws if a file entry is missing src', () => {
    const dir = join(tmp, 'bad3')
    mkdirSync(dir)
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify({
      topic: 'hooks',
      files: [{ targets: { claude: '~/.claude/hooks/x.sh' } }]
    }))
    expect(() => loadManifest(dir)).toThrow(/src/)
  })

  it('throws if a file entry is missing targets', () => {
    const dir = join(tmp, 'bad4')
    mkdirSync(dir)
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify({
      topic: 'hooks',
      files: [{ src: 'x.sh' }]
    }))
    expect(() => loadManifest(dir)).toThrow(/targets/)
  })
})

describe('loadManifests', () => {
  it('loads all manifest.json files under .agents/', () => {
    const agentsDir = join(tmp, '.agents')
    const hooksDir = join(agentsDir, 'hooks')
    const skillsDir = join(agentsDir, 'skills')
    mkdirSync(hooksDir, { recursive: true })
    mkdirSync(skillsDir, { recursive: true })

    writeFileSync(join(hooksDir, 'manifest.json'), JSON.stringify({
      topic: 'hooks', files: []
    }))
    writeFileSync(join(skillsDir, 'manifest.json'), JSON.stringify({
      topic: 'skills', files: []
    }))

    const manifests = loadManifests(agentsDir)
    expect(manifests).toHaveLength(2)
    expect(manifests.map(m => m.topic).sort()).toEqual(['hooks', 'skills'])
  })

  it('returns empty array when .agents/ has no subdirectories', () => {
    const agentsDir = join(tmp, '.agents')
    mkdirSync(agentsDir)
    expect(loadManifests(agentsDir)).toEqual([])
  })
})
