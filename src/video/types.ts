/** Durable lifecycle states exposed by the video feature. */
export type VideoStatus =
  | 'uploading'
  | 'queued'
  | 'validating'
  | 'transcoding'
  | 'detecting'
  | 'extracting'
  | 'ready'
  | 'analyzing'
  | 'summarizing'
  | 'partial'
  | 'done'
  | 'failed'
  | 'cancelled'
  | 'paused_config'

/** One extracted frame address owned by a prepared video. */
export interface PreparedFrame {
  frameId: string
  timestampSeconds: number
  file: string
  highResolutionFile?: string
}

/** Media facts committed only after the engine has verified every artifact. */
export interface PreparedVideo {
  normalizedFile: string
  posterFile: string
  durationSeconds: number
  width: number
  height: number
  frames: PreparedFrame[]
  warnings: string[]
  sceneEngine: 'pyscenedetect'
}

/** One decoded frame passed to the configured vision endpoint. */
export interface FrameInterpretInput {
  frameId: string
  timestampSeconds: number
  mediaType: 'image/jpeg'
  data: Uint8Array
}

/** Replaceable vision boundary used by the video coordinator. */
export interface FrameInterpreter {
  describe(request: {
    frames: readonly FrameInterpretInput[]
    prompt: string
    signal?: AbortSignal
  }): Promise<string>
}

/** Timestamped model evidence from one bounded frame batch. */
export interface VideoEvidence {
  frameIds: string[]
  timestampsSeconds: number[]
  description: string
}

/** Durable result returned to the current DSH text model for synthesis. */
export interface VideoAnalysisResult {
  videoId: string
  fileName: string
  durationSeconds: number
  prompt: string
  evidence: VideoEvidence[]
  warnings: string[]
}

export interface VideoAnalysisRequest {
  sessionId: string
  videoId: string
  prompt?: string
  signal?: AbortSignal
}

/** Sanitized dependency facts shown by the video settings surface. */
export interface VideoCapabilityReport {
  available: boolean
  ffmpeg?: { version: string }
  ffprobe?: { version: string }
  sceneDetect?: { version: string }
  features: {
    libx264: boolean
    nvenc: boolean
    hdrToneMap: boolean
    deinterlace: boolean
  }
  issues: Array<{ code: string; message: string }>
}

/** Input passed through the internal media-engine seam. */
export interface MediaPrepareRequest {
  videoId: string
  sourceFile: string
  originalFileName: string
  outputDir: string
  signal?: AbortSignal
  onStatus(status: Extract<VideoStatus, 'validating' | 'transcoding' | 'detecting' | 'extracting'>): Promise<void>
}

/** The true external command seam; production and deterministic test adapters implement it. */
export interface MediaEngine {
  health(): Promise<VideoCapabilityReport>
  prepare(request: MediaPrepareRequest): Promise<PreparedVideo>
  extractRange(request: {
    videoId: string
    normalizedFile: string
    outputDir: string
    startSeconds?: number
    endSeconds?: number
    limit: number
    signal?: AbortSignal
  }): Promise<PreparedFrame[]>
}

/** Browser-safe projection of one video. Paths and mutable manifest details never cross this interface. */
export interface VideoSnapshot {
  videoId: string
  sessionId: string
  fileName: string
  mediaType: string
  sizeBytes: number
  sha256: string
  status: VideoStatus
  createdAt: number
  updatedAt: number
  durationSeconds?: number
  width?: number
  height?: number
  normalizedUrl?: string
  posterUrl?: string
  frameCount?: number
  warnings: string[]
  sceneEngine?: 'pyscenedetect'
  error?: { code: string; message: string }
  analysis?: VideoAnalysisResult
}

/** Metadata accepted before a browser starts streaming bytes. */
export interface VideoUploadMetadata {
  sessionId: string
  fileName: string
  mediaType: string
  declaredSize: number
}

/** Bytes for one already-created upload intent. */
export interface VideoUploadBody {
  videoId: string
  sessionId: string
  body: AsyncIterable<Uint8Array>
  signal?: AbortSignal
}

/** Convenience shape used when metadata and bytes arrive in one operation. */
export interface VideoUpload extends VideoUploadMetadata {
  body: AsyncIterable<Uint8Array>
  signal?: AbortSignal
}

/** Configurable defaults plus non-bypassable per-video limits. */
export interface VideoLimits {
  maxUploadBytes: number
  hardMaxUploadBytes: number
}

/** Lazy local content descriptor consumed by the same-origin HTTP adapter. */
export interface VideoContent {
  mediaType: 'video/mp4' | 'image/jpeg'
  sizeBytes: number
  etag: string
  open(range?: { start: number; end: number }): AsyncIterable<Uint8Array>
}

/** Small caller-facing interface shared by HTTP, tool, and future UI adapters. */
export interface VideoCoordinator {
  upload(input: VideoUpload): Promise<VideoSnapshot>
  createUpload(input: VideoUploadMetadata): Promise<VideoSnapshot>
  writeUpload(input: VideoUploadBody): Promise<VideoSnapshot>
  list(sessionId: string): Promise<VideoSnapshot[]>
  delete(sessionId: string, videoId: string): Promise<void>
  content(videoId: string, kind: 'video' | 'poster'): Promise<VideoContent>
  health(): Promise<VideoCapabilityReport>
  analyze(input: VideoAnalysisRequest): Promise<VideoAnalysisResult>
}

/** Dependencies accepted by the coordinator installation seam. */
export interface VideoCoordinatorOptions {
  rootDir: string
  mediaEngine: MediaEngine
  frameInterpreter?: FrameInterpreter
  /** Total plugin-owned video storage budget; clamped to 100 GiB. */
  storageQuotaBytes?: number
  limits?: Partial<VideoLimits>
  now?: () => number
  createId?: () => string
}
