export interface ManifestFile {
  src: string
  targets: Record<string, string | null>
}

export interface Manifest {
  topic: string
  description?: string
  files: ManifestFile[]
}

export type ProviderId = string

export interface Provider {
  id: ProviderId
  name: string
  configDir: string
  detectionPath: string  // relative to homeDir; what must exist for this provider to be detected
}

export type ConflictAction = 'skip' | 'overwrite' | 'backup' | 'diff'

export interface SymlinkPlan {
  src: string        // absolute source path
  target: string     // absolute target path
  status: 'create' | 'skip-already-linked' | 'skip-null' | 'conflict'
}

export interface InstallRecord {
  topic: string
  provider: string
  symlinkPath: string
  sourcePath: string
  backupPath?: string
  installedAt: string
}

export interface InstallManifest {
  records: InstallRecord[]
}

export type ApplyStatus =
  | 'linked'         // symlink created successfully
  | 'backed-up'      // conflicting file backed up then linked
  | 'skipped'        // already linked or conflict-strategy=skip
  | 'would-create'   // dryRun=true, would link
  | 'would-conflict' // dryRun=true, conflict would be encountered
  | 'error'          // failed

export interface ApplyResult {
  status: ApplyStatus
  src: string
  target: string
  topic: string
  provider: string
  record?: InstallRecord   // present when status is 'linked' or 'backed-up'
  backupPath?: string      // present when status is 'backed-up' or 'would-conflict'
  error?: string           // present when status is 'error'
}

export interface SyncCache {
  lastSync: string   // ISO 8601
}
