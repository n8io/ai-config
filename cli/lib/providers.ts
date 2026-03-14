import { existsSync } from 'fs'
import { join } from 'path'
import type { Provider } from '../types'

export const KNOWN_PROVIDERS: Provider[] = [
  {
    id: 'claude',
    name: 'Claude Code',
    configDir: '.claude',
    detectionPath: '.claude/settings.json',  // file: bare .claude dir isn't enough
  },
  {
    id: 'cursor',
    name: 'Cursor',
    configDir: '.cursor',
    detectionPath: '.cursor',  // directory presence is sufficient
  },
]

export function detectProviders(homeDir: string): Provider[] {
  return KNOWN_PROVIDERS.filter(p => existsSync(join(homeDir, p.detectionPath)))
}
