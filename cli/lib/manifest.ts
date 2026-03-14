import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import type { Manifest } from '../types'

export function loadManifest(topicDir: string): Manifest {
  const manifestPath = join(topicDir, 'manifest.json')
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(manifestPath, 'utf-8'))
  } catch {
    throw new Error(`Failed to read manifest at ${manifestPath}`)
  }

  const obj = raw as Record<string, unknown>
  if (typeof obj.topic !== 'string') {
    throw new Error(`Manifest at ${manifestPath} missing required field: topic`)
  }
  if (!Array.isArray(obj.files)) {
    throw new Error(`Manifest at ${manifestPath} missing required field: files`)
  }
  for (const file of obj.files as unknown[]) {
    const f = file as Record<string, unknown>
    if (typeof f.src !== 'string') {
      throw new Error(`Manifest at ${manifestPath}: files[].src must be a string`)
    }
    if (!f.targets || typeof f.targets !== 'object' || Array.isArray(f.targets)) {
      throw new Error(`Manifest at ${manifestPath}: files[].targets must be an object`)
    }
    for (const [key, value] of Object.entries(f.targets as Record<string, unknown>)) {
      if (value !== null && typeof value !== 'string') {
        throw new Error(`Manifest at ${manifestPath}: files[].targets.${key} must be string or null, got ${typeof value}`)
      }
    }
  }

  return obj as Manifest
}

export function loadManifests(agentsDir: string): Manifest[] {
  let entries: string[]
  try {
    entries = readdirSync(agentsDir)
  } catch {
    return []
  }

  const manifests: Manifest[] = []
  for (const entry of entries) {
    const topicDir = join(agentsDir, entry)
    if (!statSync(topicDir).isDirectory()) continue
    try {
      manifests.push(loadManifest(topicDir))
    } catch {
      // skip directories without manifest.json
    }
  }
  return manifests
}
