import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync, readlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { applyTopics } from '../lib/apply-topics'
import type { Manifest, Provider } from '../types'

let tmp: string

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'ai-config-test-'))
})

afterEach(() => {
  rmSync(tmp, { recursive: true })
})

const repoDir = () => join(tmp, 'repo')

// applyTopics constructs src as join(repoDir, '.agents', manifest.topic, file.src)
// so we must create the file at that exact path
const srcFile = (name = 'AGENTS.md', topic = 'rules') => {
  const src = join(repoDir(), '.agents', topic, name)
  mkdirSync(join(repoDir(), '.agents', topic), { recursive: true })
  writeFileSync(src, '# rules')
  return src
}

const provider: Provider = { id: 'claude', name: 'Claude Code', configDir: '.claude', detectionPath: '.claude/settings.json' }

// manifest.files[].src is the filename only; applyTopics resolves the full path
const manifest = (targetPath: string, topic = 'rules', fileName = 'AGENTS.md'): Manifest => ({
  topic,
  description: 'Test rules',
  files: [{ src: fileName, targets: { claude: targetPath } }]
})

describe('applyTopics — dryRun: true', () => {
  it('returns would-create when target does not exist', async () => {
    const src = srcFile()
    const target = join(tmp, 'home', '.claude', 'AGENTS.md')
    const results = await applyTopics(
      [manifest(target)],
      [provider],
      repoDir(),
      { dryRun: true, verbose: false, conflictStrategy: 'skip' }
    )
    expect(results).toHaveLength(1)
    expect(results[0].status).toBe('would-create')
    expect(results[0].topic).toBe('rules')
    expect(results[0].provider).toBe('claude')
    expect(results[0].record).toBeUndefined()
  })

  it('returns skipped when target is already linked to src', async () => {
    const src = srcFile()
    const targetDir = join(tmp, 'home', '.claude')
    mkdirSync(targetDir, { recursive: true })
    const target = join(targetDir, 'AGENTS.md')
    symlinkSync(src, target)

    const results = await applyTopics(
      [manifest(target)],
      [provider],
      repoDir(),
      { dryRun: true, verbose: false, conflictStrategy: 'skip' }
    )
    expect(results[0].status).toBe('skipped')
  })

  it('returns would-conflict when target exists and is not linked to src', async () => {
    const src = srcFile()
    const targetDir = join(tmp, 'home', '.claude')
    mkdirSync(targetDir, { recursive: true })
    const target = join(targetDir, 'AGENTS.md')
    writeFileSync(target, 'existing content')

    const results = await applyTopics(
      [manifest(target)],
      [provider],
      repoDir(),
      { dryRun: true, verbose: false, conflictStrategy: 'backup' }
    )
    expect(results[0].status).toBe('would-conflict')
  })

  it('skips targets with null value', async () => {
    const src = srcFile()
    const m: Manifest = { topic: 'rules', files: [{ src: 'AGENTS.md', targets: { claude: null } }] }
    const results = await applyTopics([m], [provider], repoDir(), { dryRun: true, verbose: false, conflictStrategy: 'skip' })
    expect(results[0].status).toBe('skipped')
  })
})

describe('applyTopics — conflictStrategy: skip', () => {
  it('creates symlink when target does not exist', async () => {
    const src = srcFile()
    const target = join(tmp, 'home', '.claude', 'AGENTS.md')

    const results = await applyTopics(
      [manifest(target)],
      [provider],
      repoDir(),
      { dryRun: false, verbose: false, conflictStrategy: 'skip' }
    )
    expect(results[0].status).toBe('linked')
    expect(results[0].record).toBeDefined()
    expect(results[0].record!.topic).toBe('rules')
    expect(results[0].record!.provider).toBe('claude')
    expect(readlinkSync(target)).toBe(src)
  })

  it('skips when conflict exists', async () => {
    const src = srcFile()
    const targetDir = join(tmp, 'home', '.claude')
    mkdirSync(targetDir, { recursive: true })
    const target = join(targetDir, 'AGENTS.md')
    writeFileSync(target, 'existing')

    const results = await applyTopics(
      [manifest(target)],
      [provider],
      repoDir(),
      { dryRun: false, verbose: false, conflictStrategy: 'skip' }
    )
    expect(results[0].status).toBe('skipped')
  })
})

describe('applyTopics — conflictStrategy: backup', () => {
  it('backs up existing file then creates symlink', async () => {
    const src = srcFile()
    const targetDir = join(tmp, 'home', '.claude')
    mkdirSync(targetDir, { recursive: true })
    const target = join(targetDir, 'AGENTS.md')
    writeFileSync(target, 'original content')

    const results = await applyTopics(
      [manifest(target)],
      [provider],
      repoDir(),
      { dryRun: false, verbose: false, conflictStrategy: 'backup' }
    )
    expect(results[0].status).toBe('backed-up')
    expect(results[0].record).toBeDefined()
    expect(results[0].backupPath).toBeDefined()
    expect(readlinkSync(target)).toBe(src)
  })
})

describe('applyTopics — conflictStrategy: overwrite', () => {
  it('overwrites existing file without backup', async () => {
    const src = srcFile()
    const targetDir = join(tmp, 'home', '.claude')
    mkdirSync(targetDir, { recursive: true })
    const target = join(targetDir, 'AGENTS.md')
    writeFileSync(target, 'existing content')

    const results = await applyTopics(
      [manifest(target)],
      [provider],
      repoDir(),
      { dryRun: false, verbose: false, conflictStrategy: 'overwrite' }
    )
    expect(results[0].status).toBe('linked')
    expect(results[0].record).toBeDefined()
    expect(results[0].backupPath).toBeUndefined()
    expect(readlinkSync(target)).toBe(src)
  })
})

describe('applyTopics — directory source', () => {
  it('creates symlink for directory src', async () => {
    // applyTopics looks for: join(repoDir, '.agents', topic, src)
    const repoPath = repoDir()
    const skillDir = join(repoPath, '.agents', 'skills', 'commit')
    mkdirSync(skillDir, { recursive: true })
    writeFileSync(join(skillDir, 'SKILL.md'), '# commit')
    const target = join(tmp, 'home', '.claude', 'skills', 'commit')
    const m: Manifest = { topic: 'skills', files: [{ src: 'commit', targets: { claude: target } }] }

    const results = await applyTopics([m], [provider], repoPath, { dryRun: false, verbose: false, conflictStrategy: 'skip' })
    expect(results[0].status).toBe('linked')
    expect(readlinkSync(target)).toBe(skillDir)
  })
})
