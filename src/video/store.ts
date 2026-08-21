import { chmod, mkdir, open, readdir, readFile, rename, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { PreparedVideo, VideoSnapshot } from './types.ts'

const MANIFEST_VERSION = 1
const MANIFEST_NAME = 'manifest.json'

export interface VideoManifest {
  version: typeof MANIFEST_VERSION
  snapshot: VideoSnapshot
  declaredSize?: number
  prepared?: PreparedVideo
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isSnapshot(value: unknown): value is VideoSnapshot {
  if (!isRecord(value)) return false
  return typeof value.videoId === 'string'
    && typeof value.sessionId === 'string'
    && typeof value.fileName === 'string'
    && typeof value.mediaType === 'string'
    && typeof value.sizeBytes === 'number'
    && typeof value.sha256 === 'string'
    && typeof value.status === 'string'
    && typeof value.createdAt === 'number'
    && typeof value.updatedAt === 'number'
    && Array.isArray(value.warnings)
}

function parseManifest(text: string): VideoManifest | undefined {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return undefined
  }
  if (!isRecord(value) || value.version !== MANIFEST_VERSION || !isSnapshot(value.snapshot)) return undefined
  return value as unknown as VideoManifest
}

/** Restrict one user-owned storage directory on POSIX; chmod is harmlessly best-effort on Windows. */
export async function ensurePrivateDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true, mode: 0o700 })
  await chmod(path, 0o700).catch(() => {})
}

/** Resolve a job directory from an opaque id without permitting nested paths. */
export function jobDirectory(rootDir: string, videoId: string): string {
  if (basename(videoId) !== videoId || !/^video-[a-zA-Z0-9_-]{8,}$/.test(videoId)) {
    throw new Error('invalid video id')
  }
  return join(rootDir, 'jobs', videoId)
}

/** Atomically commit one complete manifest. */
export async function writeManifest(jobDir: string, manifest: VideoManifest): Promise<void> {
  await ensurePrivateDirectory(jobDir)
  const target = join(jobDir, MANIFEST_NAME)
  const temporary = join(jobDir, `${MANIFEST_NAME}.tmp`)
  const handle = await open(temporary, 'w', 0o600)
  try {
    await handle.writeFile(`${JSON.stringify(manifest)}\n`, 'utf8')
    await handle.sync()
  } finally {
    await handle.close()
  }
  await rename(temporary, target)
  await chmod(target, 0o600).catch(() => {})
}

/** Restore valid manifests and isolate corrupt or unsupported files by omission. */
export async function loadManifests(rootDir: string): Promise<VideoManifest[]> {
  const jobsDir = join(rootDir, 'jobs')
  let entries
  try {
    entries = await readdir(jobsDir, { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
  const manifests: VideoManifest[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    try {
      const parsed = parseManifest(await readFile(join(jobsDir, entry.name, MANIFEST_NAME), 'utf8'))
      if (parsed !== undefined) manifests.push(parsed)
    } catch {
      // A single corrupt or half-written job must not disable the video library.
    }
  }
  return manifests
}

/** Sum regular-file bytes below one opaque job directory without following links. */
export async function directorySize(path: string): Promise<number> {
  let total = 0
  let entries
  try {
    entries = await readdir(path, { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 0
    throw error
  }
  for (const entry of entries) {
    const child = join(path, entry.name)
    if (entry.isDirectory()) total += await directorySize(child)
    else if (entry.isFile()) total += (await stat(child)).size
  }
  return total
}
