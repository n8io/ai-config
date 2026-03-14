import { describe, it, expect } from 'bun:test'
import { expandTilde, resolveTarget } from '../lib/paths'
import { homedir } from 'os'

describe('expandTilde', () => {
  it('expands leading ~ to home directory', () => {
    expect(expandTilde('~/.claude/settings.json')).toBe(`${homedir()}/.claude/settings.json`)
  })

  it('returns absolute paths unchanged', () => {
    expect(expandTilde('/absolute/path')).toBe('/absolute/path')
  })

  it('returns relative paths unchanged', () => {
    expect(expandTilde('relative/path')).toBe('relative/path')
  })

  it('expands bare ~ to home directory', () => {
    expect(expandTilde('~')).toBe(homedir())
  })
})

describe('resolveTarget', () => {
  it('expands tilde and returns the absolute target path', () => {
    const result = resolveTarget('~/.claude/hooks/tool.sh')
    expect(result).toBe(`${homedir()}/.claude/hooks/tool.sh`)
  })
})
