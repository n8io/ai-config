import { spawnSync } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

const REPO_URL = 'https://github.com/n8io/ai-config.git'

export class GitError extends Error {
  constructor(
    message: string,
    public readonly stderr: string
  ) {
    super(message)
    this.name = 'GitError'
  }
}

/**
 * Returns true if the given directory is a git repository.
 */
export function isGitRepo(dir: string): boolean {
  return existsSync(join(dir, '.git'))
}

/**
 * Clones the ai-config repo to destDir.
 * Throws GitError on failure.
 */
export function cloneRepo(destDir: string): void {
  const result = spawnSync('git', ['clone', REPO_URL, destDir], {
    encoding: 'utf-8',
  })
  if (result.status !== 0) {
    throw new GitError('git clone failed', result.stderr ?? '')
  }
}

/**
 * Pulls latest changes in repoDir.
 * Returns { ok, error } — non-throwing (for hooks that must not block session).
 */
export function pullRepo(repoDir: string): { ok: boolean; error?: string } {
  const result = spawnSync('git', ['pull', 'origin', 'main'], {
    cwd: repoDir,
    encoding: 'utf-8',
  })
  if (result.status !== 0) {
    return { ok: false, error: result.stderr ?? 'git pull failed' }
  }
  return { ok: true }
}

/**
 * Pulls latest changes in repoDir.
 * Throws GitError on failure (for manual `update` command that should fail loudly).
 */
export function pullRepoOrThrow(repoDir: string): void {
  const result = pullRepo(repoDir)
  if (!result.ok) {
    throw new GitError('git pull failed', result.error ?? '')
  }
}
