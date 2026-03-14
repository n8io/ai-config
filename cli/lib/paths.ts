import { homedir } from 'os'

export function expandTilde(p: string): string {
  if (p.startsWith('~/') || p === '~') {
    return homedir() + p.slice(1)
  }
  return p
}

export function resolveTarget(target: string): string {
  return expandTilde(target)
}
