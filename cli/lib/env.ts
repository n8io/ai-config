import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

export const HOME = homedir()
export const DEFAULT_REPO_DIR = join(HOME, '.ai-config')

/**
 * Returns true when running directly from the source repo (bun run cli).
 * Checks that CWD has both a package.json named @n8io/ai-config AND a .git directory.
 * Running via bunx/npx from inside the repo does NOT trigger this.
 */
export function isLocalDevMode(): boolean {
  try {
    const cwd = process.cwd()
    const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf-8')) as { name?: string }
    return pkg.name === '@n8io/ai-config' && existsSync(join(cwd, '.git'))
  } catch {
    return false
  }
}

export function getRepoDir(): string {
  return isLocalDevMode() ? process.cwd() : DEFAULT_REPO_DIR
}
