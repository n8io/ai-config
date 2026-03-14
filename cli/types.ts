export interface ManifestFile {
  src: string
  targets: Record<string, string | null>
}

export interface Manifest {
  topic: string
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
  symlinkPath: string
  sourcePath: string
  backupPath?: string
  installedAt: string
}

export interface InstallManifest {
  records: InstallRecord[]
}

export interface SyncCache {
  lastSync: string   // ISO 8601
}
