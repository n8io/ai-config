import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, lstatSync, readlinkSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { planSymlink, applySymlink, verifySymlinks } from '../lib/symlink'

let tmp: string
let repoDir: string
let targetBase: string

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'ai-config-test-'))
  repoDir = join(tmp, 'repo')
  targetBase = join(tmp, 'home')
  mkdirSync(repoDir)
  mkdirSync(targetBase)
})

afterEach(() => {
  rmSync(tmp, { recursive: true })
})

describe('planSymlink', () => {
  it('returns create for a nonexistent target', () => {
    const src = join(repoDir, 'tool.sh')
    writeFileSync(src, '#!/bin/bash')
    const target = join(targetBase, '.claude', 'hooks', 'tool.sh')

    const plan = planSymlink(src, target, repoDir)
    expect(plan.status).toBe('create')
  })

  it('returns skip-already-linked when target already points into repo', () => {
    const src = join(repoDir, 'tool.sh')
    writeFileSync(src, '#!/bin/bash')
    const hooksDir = join(targetBase, 'hooks')
    mkdirSync(hooksDir)
    const target = join(hooksDir, 'tool.sh')
    symlinkSync(src, target)

    const plan = planSymlink(src, target, repoDir)
    expect(plan.status).toBe('skip-already-linked')
  })

  it('returns conflict when target exists as a regular file', () => {
    const src = join(repoDir, 'tool.sh')
    writeFileSync(src, '#!/bin/bash')
    const hooksDir = join(targetBase, 'hooks')
    mkdirSync(hooksDir)
    const target = join(hooksDir, 'tool.sh')
    writeFileSync(target, 'existing content')

    const plan = planSymlink(src, target, repoDir)
    expect(plan.status).toBe('conflict')
  })

  it('returns conflict when target is a symlink pointing outside repo', () => {
    const src = join(repoDir, 'tool.sh')
    writeFileSync(src, '#!/bin/bash')
    const otherFile = join(tmp, 'other.sh')
    writeFileSync(otherFile, 'other')
    const hooksDir = join(targetBase, 'hooks')
    mkdirSync(hooksDir)
    const target = join(hooksDir, 'tool.sh')
    symlinkSync(otherFile, target)

    const plan = planSymlink(src, target, repoDir)
    expect(plan.status).toBe('conflict')
  })

  it('returns conflict when target is a broken symlink pointing outside repo', () => {
    const src = join(repoDir, 'tool.sh')
    writeFileSync(src, '#!/bin/bash')
    const hooksDir = join(targetBase, 'hooks')
    mkdirSync(hooksDir)
    const target = join(hooksDir, 'tool.sh')
    // Symlink to a nonexistent path outside the repo
    symlinkSync(join(tmp, 'nonexistent-outside-repo.sh'), target)

    const plan = planSymlink(src, target, repoDir)
    expect(plan.status).toBe('conflict')
  })
})

describe('applySymlink', () => {
  it('creates a symlink and intermediate directories', () => {
    const src = join(repoDir, 'tool.sh')
    writeFileSync(src, '#!/bin/bash')
    const target = join(targetBase, 'deep', 'nested', 'tool.sh')

    applySymlink(src, target)

    expect(existsSync(target)).toBe(true)
    expect(readlinkSync(target)).toBe(src)
  })
})

describe('verifySymlinks', () => {
  it('returns broken symlinks', () => {
    const brokenTarget = join(targetBase, 'broken.sh')
    symlinkSync(join(repoDir, 'nonexistent.sh'), brokenTarget)

    const goodSrc = join(repoDir, 'good.sh')
    writeFileSync(goodSrc, '#!/bin/bash')
    const goodTarget = join(targetBase, 'good.sh')
    symlinkSync(goodSrc, goodTarget)

    const records = [
      { symlinkPath: brokenTarget, sourcePath: join(repoDir, 'nonexistent.sh'), installedAt: '' },
      { symlinkPath: goodTarget, sourcePath: goodSrc, installedAt: '' },
    ]
    const broken = verifySymlinks(records)
    expect(broken).toHaveLength(1)
    expect(broken[0].symlinkPath).toBe(brokenTarget)
  })
})
