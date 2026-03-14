import { readFileSync, writeFileSync } from 'fs'
import type { InstallManifest, InstallRecord } from '../types'

export function readInstallManifest(manifestPath: string): InstallManifest {
  try {
    return JSON.parse(readFileSync(manifestPath, 'utf-8')) as InstallManifest
  } catch {
    return { records: [] }
  }
}

export function appendInstallRecord(
  manifestPath: string,
  record: InstallRecord
): void {
  const manifest = readInstallManifest(manifestPath)
  manifest.records.push(record)
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
}
