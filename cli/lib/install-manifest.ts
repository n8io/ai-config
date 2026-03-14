import { readFileSync, writeFileSync } from 'fs'
import type { InstallManifest, InstallRecord } from '../types'

export function readInstallManifest(manifestPath: string): InstallManifest {
  try {
    return JSON.parse(readFileSync(manifestPath, 'utf-8')) as InstallManifest
  } catch {
    return { records: [] }
  }
}

export function writeInstallManifest(manifestPath: string, manifest: InstallManifest): void {
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
}

export function appendInstallRecord(
  manifestPath: string,
  record: InstallRecord
): void {
  const manifest = readInstallManifest(manifestPath)
  manifest.records.push(record)
  writeInstallManifest(manifestPath, manifest)
}
