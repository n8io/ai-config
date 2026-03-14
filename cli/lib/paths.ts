import { homedir } from 'os'
import { resolve } from 'path'

export function expandTilde(p: string): string {
  if (p.startsWith('~/') || p === '~') {
    return homedir() + p.slice(1)
  }
  return p
}

/** Expands tilde and guarantees an absolute path. */
export function resolveTarget(target: string): string {
  return resolve(expandTilde(target))
}
