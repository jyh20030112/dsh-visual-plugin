import { createHash, randomBytes } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { chmod, open, readFile, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  PreparedFrame,
  PreparedVideo,
  VideoAnalysisRequest,
  VideoAnalysisResult,
  VideoCoordinator,
  VideoCoordinatorOptions,
  VideoContent,
  VideoLimits,
  VideoSnapshot,
  VideoStatus,
  VideoUpload,
  VideoUploadBody,
  VideoUploadMetadata,
} from './types.ts'
import {
  ensurePrivateDirectory,
  directorySize,
  jobDirectory,
  loadManifests,
  writeManifest,
  type VideoManifest,
} from './store.ts'

const DEFAULT_LIMITS: VideoLimits = {
  maxUploadBytes: 200 * 1024 * 1024,
  hardMaxUploadBytes: 2 * 1024 * 1024 * 1024,
}

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000
const DEFAULT_STORAGE_QUOTA = 2 * 1024 * 1024 * 1024
const HARD_STORAGE_QUOTA = 100 * 1024 * 1024 * 1024
const RESTORABLE_STATUSES = new Set<VideoStatus>(['ready', 'done', 'partial', 'failed', 'cancelled', 'paused_config'])

function displayFileName(value: string): string {
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, '').trim()
  return cleaned.length === 0 ? 'video' : cleaned.slice(0, 255)
}

function randomVideoId(): string {
  return `video-${randomBytes(16).toString('hex')}`
}

function limitsOf(options: VideoCoordinatorOptions): VideoLimits {
  const hardMaxUploadBytes = options.limits?.hardMaxUploadBytes ?? DEFAULT_LIMITS.hardMaxUploadBytes
  const requested = options.limits?.maxUploadBytes ?? DEFAULT_LIMITS.maxUploadBytes
  return {
    hardMaxUploadBytes,
    maxUploadBytes: Math.min(requested, hardMaxUploadBytes),
  }
}

function publicSnapshot(snapshot: VideoSnapshot): VideoSnapshot {
  return structuredClone(snapshot)
}

class DefaultVideoCoordinator implements VideoCoordinator {
  private readonly manifests = new Map<string, VideoManifest>()
  private readonly limits: VideoLimits
  private readonly now: () => number
  private readonly createId: () => string
  private readonly options: VideoCoordinatorOptions
  private readonly storageQuotaBytes: number
  private processingActive = 0
  private readonly processingWaiters: Array<{
    resolve: (release: () => void) => void
    reject: (error: unknown) => void
    signal?: AbortSignal
    onAbort?: () => void
  }> = []

  private constructor(options: VideoCoordinatorOptions) {
    this.options = options
    this.limits = limitsOf(options)
    this.now = options.now ?? Date.now
    this.createId = options.createId ?? randomVideoId
    this.storageQuotaBytes = Math.min(
      HARD_STORAGE_QUOTA,
      Math.max(1, options.storageQuotaBytes ?? DEFAULT_STORAGE_QUOTA),
    )
  }

  static async create(options: VideoCoordinatorOptions): Promise<DefaultVideoCoordinator> {
    const coordinator = new DefaultVideoCoordinator(options)
    await ensurePrivateDirectory(options.rootDir)
    await ensurePrivateDirectory(join(options.rootDir, 'jobs'))
    for (const manifest of await loadManifests(options.rootDir)) {
      const jobDir = jobDirectory(options.rootDir, manifest.snapshot.videoId)
      if (RESTORABLE_STATUSES.has(manifest.snapshot.status)
        && coordinator.now() - manifest.snapshot.updatedAt >= RETENTION_MS) {
        await rm(jobDir, { recursive: true, force: true })
        continue
      }
      if (!RESTORABLE_STATUSES.has(manifest.snapshot.status)) {
        manifest.snapshot = {
          ...manifest.snapshot,
          status: 'failed',
          updatedAt: coordinator.now(),
          error: {
            code: 'interrupted_by_restart',
            message: 'Video processing was interrupted by a host restart. Upload the video again.',
          },
        }
        await writeManifest(jobDir, manifest)
      }
      coordinator.manifests.set(manifest.snapshot.videoId, manifest)
    }
    return coordinator
  }

  async upload(input: VideoUpload): Promise<VideoSnapshot> {
    const staged = await this.createUpload(input)
    return this.writeUpload({
      videoId: staged.videoId,
      sessionId: input.sessionId,
      body: input.body,
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    })
  }

  async createUpload(input: VideoUploadMetadata): Promise<VideoSnapshot> {
    this.validateUpload(input)
    await this.enforceStorageQuota(input.declaredSize)
    const videoId = this.createId()
    if (this.manifests.has(videoId)) throw new Error(`duplicate video id: ${videoId}`)
    const jobDir = jobDirectory(this.options.rootDir, videoId)
    await ensurePrivateDirectory(jobDir)
    const createdAt = this.now()
    const uploading: VideoSnapshot = {
      videoId,
      sessionId: input.sessionId,
      fileName: displayFileName(input.fileName),
      mediaType: input.mediaType,
      sizeBytes: 0,
      sha256: '',
      status: 'uploading',
      createdAt,
      updatedAt: createdAt,
      warnings: [],
    }
    const manifest: VideoManifest = { version: 1, snapshot: uploading, declaredSize: input.declaredSize }
    this.manifests.set(videoId, manifest)
    await writeManifest(jobDir, manifest)
    return publicSnapshot(uploading)
  }

  async writeUpload(input: VideoUploadBody): Promise<VideoSnapshot> {
    const manifest = this.owned(input.sessionId, input.videoId)
    if (manifest.snapshot.status !== 'uploading' || manifest.declaredSize === undefined) {
      const error = new Error('video is not waiting for upload bytes') as Error & { code?: string }
      error.code = 'invalid_video_state'
      throw error
    }
    input.signal?.throwIfAborted()
    const videoId = manifest.snapshot.videoId
    const jobDir = jobDirectory(this.options.rootDir, videoId)
    const sourceFile = join(jobDir, 'source.upload')
    let release: (() => void) | undefined
    try {
      const { sizeBytes, sha256 } = await this.writeUploadFile(sourceFile, input, manifest.declaredSize)
      const duplicate = [...this.manifests.values()].find(candidate =>
        candidate !== manifest
        && candidate.snapshot.sessionId === manifest.snapshot.sessionId
        && candidate.snapshot.sha256 === sha256
        && candidate.prepared !== undefined
        && ['ready', 'done', 'partial'].includes(candidate.snapshot.status))
      if (duplicate !== undefined) {
        this.manifests.delete(videoId)
        await rm(jobDir, { recursive: true, force: true })
        return publicSnapshot(duplicate.snapshot)
      }
      await this.transition(manifest, jobDir, 'queued', { sizeBytes, sha256 })
      release = await this.acquireProcessing(input.signal)
      const prepared = await this.options.mediaEngine.prepare({
        videoId,
        sourceFile,
        originalFileName: manifest.snapshot.fileName,
        outputDir: jobDir,
        ...(input.signal === undefined ? {} : { signal: input.signal }),
        onStatus: status => this.transition(manifest, jobDir, status),
      })
      this.validatePrepared(prepared)
      manifest.prepared = structuredClone(prepared)
      await rm(sourceFile, { force: true })
      await this.transition(manifest, jobDir, 'ready', {
        durationSeconds: prepared.durationSeconds,
        width: prepared.width,
        height: prepared.height,
        normalizedUrl: `/vision-bridge/videos/${videoId}/content`,
        posterUrl: `/vision-bridge/videos/${videoId}/poster`,
        frameCount: prepared.frames.length,
        warnings: [...prepared.warnings],
        sceneEngine: prepared.sceneEngine,
      })
      await this.enforceStorageQuota(0, videoId)
      return publicSnapshot(manifest.snapshot)
    } catch (error) {
      await this.transition(manifest, jobDir, 'failed', {
        error: {
          code: (error as { code?: unknown } | null)?.code === undefined
            ? 'video_processing_failed'
            : String((error as { code?: unknown }).code),
          message: error instanceof Error ? error.message : String(error),
        },
      }).catch(() => {})
      throw error
    } finally {
      release?.()
    }
  }

  async list(sessionId: string): Promise<VideoSnapshot[]> {
    return [...this.manifests.values()]
      .map(manifest => manifest.snapshot)
      .filter(snapshot => snapshot.sessionId === sessionId)
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .map(publicSnapshot)
  }

  async delete(sessionId: string, videoId: string): Promise<void> {
    const manifest = this.owned(sessionId, videoId)
    if (!RESTORABLE_STATUSES.has(manifest.snapshot.status)) {
      const error = new Error('active video work cannot be deleted') as Error & { code?: string }
      error.code = 'invalid_video_state'
      throw error
    }
    this.manifests.delete(videoId)
    await rm(jobDirectory(this.options.rootDir, videoId), { recursive: true, force: true })
  }

  health() {
    return this.options.mediaEngine.health()
  }

  async content(videoId: string, kind: 'video' | 'poster'): Promise<VideoContent> {
    const manifest = this.manifests.get(videoId)
    const fileName = kind === 'video' ? manifest?.prepared?.normalizedFile : manifest?.prepared?.posterFile
    if (manifest === undefined || fileName === undefined || !['ready', 'done', 'partial'].includes(manifest.snapshot.status)) {
      const error = new Error('video content was not found') as Error & { code?: string }
      error.code = 'video_not_found'
      throw error
    }
    const path = join(jobDirectory(this.options.rootDir, videoId), fileName)
    const info = await stat(path)
    return {
      mediaType: kind === 'video' ? 'video/mp4' : 'image/jpeg',
      sizeBytes: info.size,
      etag: `"sha256-${manifest.snapshot.sha256}"`,
      open: range => createReadStream(path, range === undefined ? {} : { start: range.start, end: range.end }),
    }
  }

  async analyze(input: VideoAnalysisRequest): Promise<VideoAnalysisResult> {
    const manifest = this.owned(input.sessionId, input.videoId)
    const prepared = manifest.prepared
    const interpreter = this.options.frameInterpreter
    if (prepared === undefined || !['ready', 'done', 'partial'].includes(manifest.snapshot.status)) {
      const error = new Error('video is not ready for analysis') as Error & { code?: string }
      error.code = 'invalid_video_state'
      throw error
    }
    if (interpreter === undefined) {
      const error = new Error('video frame interpreter is not configured') as Error & { code?: string }
      error.code = 'video_dependencies_unavailable'
      throw error
    }
    input.signal?.throwIfAborted()
    const jobDir = jobDirectory(this.options.rootDir, input.videoId)
    const prompt = input.prompt?.trim() || 'Describe what happens in this video, preserving temporal order and visible text.'
    await this.transition(manifest, jobDir, 'analyzing', { error: undefined })
    const batches: PreparedFrame[][] = []
    for (let index = 0; index < prepared.frames.length; index += 6) {
      batches.push(prepared.frames.slice(index, index + 6))
    }
    const evidence: Array<VideoAnalysisResult['evidence'][number] | undefined> = new Array(batches.length)
    const failures: string[] = []
    let cursor = 0
    const worker = async (): Promise<void> => {
      while (cursor < batches.length) {
        const index = cursor
        cursor += 1
        const batch = batches[index] ?? []
        try {
          const frames = await Promise.all(batch.map(async frame => ({
            frameId: frame.frameId,
            timestampSeconds: frame.timestampSeconds,
            mediaType: 'image/jpeg' as const,
            data: await readFile(join(jobDir, frame.highResolutionFile ?? frame.file)),
          })))
          input.signal?.throwIfAborted()
          const description = await interpreter.describe({
            frames,
            prompt,
            ...(input.signal === undefined ? {} : { signal: input.signal }),
          })
          evidence[index] = {
            frameIds: batch.map(frame => frame.frameId),
            timestampsSeconds: batch.map(frame => frame.timestampSeconds),
            description,
          }
          await Promise.all(batch.map(frame => frame.highResolutionFile === undefined
            ? Promise.resolve()
            : rm(join(jobDir, frame.highResolutionFile), { force: true })))
        } catch (error) {
          failures.push(error instanceof Error ? error.message : String(error))
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(2, batches.length) }, worker))
    const completed = evidence.filter(value => value !== undefined)
    if (completed.length === 0) {
      const error = new Error(failures[0] ?? 'video frame analysis returned no evidence') as Error & { code?: string }
      error.code = 'video_analysis_failed'
      await this.transition(manifest, jobDir, 'failed', { error: { code: error.code, message: error.message } })
      throw error
    }
    const result: VideoAnalysisResult = {
      videoId: manifest.snapshot.videoId,
      fileName: manifest.snapshot.fileName,
      durationSeconds: prepared.durationSeconds,
      prompt,
      evidence: completed,
      warnings: [...prepared.warnings, ...failures.map(message => `frame_batch_failed:${message}`)],
    }
    await this.transition(manifest, jobDir, failures.length === 0 ? 'done' : 'partial', {
      analysis: result,
      warnings: result.warnings,
    })
    return structuredClone(result)
  }

  private validateUpload(input: VideoUploadMetadata): void {
    if (input.sessionId.trim().length === 0) throw new Error('session id is required')
    if (!Number.isSafeInteger(input.declaredSize) || input.declaredSize < 1) {
      throw new Error('declared video size must be a positive integer')
    }
    if (input.declaredSize > this.limits.maxUploadBytes) {
      const error = new Error(`video exceeds upload limit of ${this.limits.maxUploadBytes} bytes`) as Error & { code?: string }
      error.code = 'upload_too_large'
      throw error
    }
  }

  private async enforceStorageQuota(requiredBytes: number, protectedVideoId?: string): Promise<void> {
    const usages = await Promise.all([...this.manifests.values()].map(async manifest => ({
      manifest,
      bytes: await directorySize(jobDirectory(this.options.rootDir, manifest.snapshot.videoId)),
    })))
    let total = usages.reduce((sum, item) => sum + item.bytes, 0)
    const evictable = usages
      .filter(item => item.manifest.snapshot.videoId !== protectedVideoId
        && RESTORABLE_STATUSES.has(item.manifest.snapshot.status))
      .sort((left, right) => left.manifest.snapshot.updatedAt - right.manifest.snapshot.updatedAt)
    for (const item of evictable) {
      if (total + requiredBytes <= this.storageQuotaBytes) break
      const videoId = item.manifest.snapshot.videoId
      this.manifests.delete(videoId)
      await rm(jobDirectory(this.options.rootDir, videoId), { recursive: true, force: true })
      total -= item.bytes
    }
    if (total + requiredBytes > this.storageQuotaBytes) {
      const error = new Error('Video storage quota is exhausted by active work.') as Error & { code?: string }
      error.code = 'storage_quota_exceeded'
      throw error
    }
  }

  private acquireProcessing(signal?: AbortSignal): Promise<() => void> {
    signal?.throwIfAborted()
    if (this.processingActive < 2) {
      this.processingActive += 1
      return Promise.resolve(this.processingRelease())
    }
    return new Promise((resolve, reject) => {
      const waiter: {
        resolve: (release: () => void) => void
        reject: (error: unknown) => void
        signal?: AbortSignal
        onAbort?: () => void
      } = { resolve, reject, ...(signal === undefined ? {} : { signal }) }
      const onAbort = (): void => {
        const index = this.processingWaiters.indexOf(waiter)
        if (index >= 0) this.processingWaiters.splice(index, 1)
        reject(signal?.reason ?? new DOMException('The operation was aborted', 'AbortError'))
      }
      waiter.onAbort = onAbort
      signal?.addEventListener('abort', onAbort, { once: true })
      this.processingWaiters.push(waiter)
    })
  }

  private processingRelease(): () => void {
    let released = false
    return () => {
      if (released) return
      released = true
      const waiter = this.processingWaiters.shift()
      if (waiter === undefined) {
        this.processingActive -= 1
        return
      }
      waiter.signal?.removeEventListener('abort', waiter.onAbort as () => void)
      waiter.resolve(this.processingRelease())
    }
  }

  private async writeUploadFile(
    path: string,
    input: VideoUploadBody,
    declaredSize: number,
  ): Promise<{ sizeBytes: number; sha256: string }> {
    const handle = await open(path, 'wx', 0o600)
    const hash = createHash('sha256')
    let sizeBytes = 0
    try {
      for await (const chunk of input.body) {
        input.signal?.throwIfAborted()
        sizeBytes += chunk.byteLength
        if (sizeBytes > this.limits.maxUploadBytes || sizeBytes > declaredSize) {
          const error = new Error('video upload exceeded its declared or configured size') as Error & { code?: string }
          error.code = 'upload_too_large'
          throw error
        }
        hash.update(chunk)
        await handle.write(chunk)
      }
      if (sizeBytes !== declaredSize) {
        const error = new Error(`video upload size mismatch: expected ${declaredSize}, received ${sizeBytes}`) as Error & { code?: string }
        error.code = 'upload_size_mismatch'
        throw error
      }
      await handle.sync()
    } finally {
      await handle.close()
      await chmod(path, 0o600).catch(() => {})
    }
    return { sizeBytes, sha256: hash.digest('hex') }
  }

  private owned(sessionId: string, videoId: string): VideoManifest {
    const manifest = this.manifests.get(videoId)
    if (manifest === undefined || manifest.snapshot.sessionId !== sessionId) {
      const error = new Error('video was not found') as Error & { code?: string }
      error.code = 'video_not_found'
      throw error
    }
    return manifest
  }

  private validatePrepared(prepared: PreparedVideo): void {
    if (!Number.isFinite(prepared.durationSeconds) || prepared.durationSeconds <= 0) {
      throw new Error('media engine returned an invalid duration')
    }
    if (!Number.isSafeInteger(prepared.width) || prepared.width < 1
      || !Number.isSafeInteger(prepared.height) || prepared.height < 1) {
      throw new Error('media engine returned invalid dimensions')
    }
    for (const file of [prepared.normalizedFile, prepared.posterFile, ...prepared.frames.flatMap(frame => [frame.file, frame.highResolutionFile].filter(value => value !== undefined))]) {
      if (file !== undefined && file !== file.split(/[\\/]/).at(-1)) {
        throw new Error('media engine returned a nested artifact path')
      }
    }
  }

  private async transition(
    manifest: VideoManifest,
    jobDir: string,
    status: VideoStatus,
    patch: Partial<VideoSnapshot> = {},
  ): Promise<void> {
    manifest.snapshot = {
      ...manifest.snapshot,
      ...patch,
      status,
      updatedAt: this.now(),
    }
    await writeManifest(jobDir, manifest)
  }
}

/** Install the deep coordinator module over storage and media adapters. */
export function createVideoCoordinator(options: VideoCoordinatorOptions): Promise<VideoCoordinator> {
  return DefaultVideoCoordinator.create(options)
}
