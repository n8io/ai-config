import { existsSync } from 'fs'
import { join } from 'path'
import type { Provider } from '../types'

export const KNOWN_PROVIDERS: Provider[] = [
  {
    id: 'claude',
    name: 'Claude Code',
    configDir: '.claude',
  },
  {
    id: 'cursor',
    name: 'Cursor',
    configDir: '.cursor',
  },
]

function getDetectionPath(provider: Provider, homeDir: string): string {
  if (provider.id === 'claude') {
    return join(homeDir, '.claude', 'settings.json')
  }
  return join(homeDir, provider.configDir)
}

export function detectProviders(homeDir: string): Provider[] {
  return KNOWN_PROVIDERS.filter(p => existsSync(getDetectionPath(p, homeDir)))
}
