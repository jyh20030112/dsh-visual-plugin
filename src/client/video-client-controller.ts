/** Browser-safe video projection returned by the plugin-owned HTTP service. */
export interface VideoItem {
  videoId: string
  sessionId: string
  fileName: string
  mediaType: string
  sizeBytes: number
  status: string
  createdAt: number
  updatedAt: number
  durationSeconds?: number
  width?: number
  height?: number
  normalizedUrl?: string
  posterUrl?: string
  frameCount?: number
  warnings: string[]
  error?: { code: string; message: string }
  analysis?: {
    prompt: string
    evidence: Array<{ timestampsSeconds: number[]; description: string }>
  }
}

/** Observable upload/list state for one conversation. */
export interface VideoClientState {
  videos: readonly VideoItem[]
  phase: 'idle' | 'uploading' | 'processing'
  progress: number
  activeFileName?: string
  error?: string
  selection?: { token: number; videoId: string }
}

interface ErrorBody {
  error?: { message?: string }
}

const EMPTY_STATE: VideoClientState = {
  videos: [],
  phase: 'idle',
  progress: 0,
}

async function responseError(response: Response): Promise<Error> {
  const body = await response.json().catch(() => ({})) as ErrorBody
  return new Error(body.error?.message ?? `Video request failed (${response.status})`)
}

function uploadBytes(
  url: string,
  file: File,
  onProgress: (progress: number) => void,
): Promise<VideoItem> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('PUT', url)
    request.setRequestHeader('Content-Type', 'application/octet-stream')
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total)
    }
    request.onerror = () => reject(new Error('Video upload connection failed.'))
    request.onabort = () => reject(new DOMException('Video upload was cancelled.', 'AbortError'))
    request.onload = () => {
      let body: { video?: VideoItem } & ErrorBody = {}
      try {
        body = JSON.parse(request.responseText) as typeof body
      } catch {
        // The status below remains the authoritative error.
      }
      if (request.status >= 200 && request.status < 300 && body.video !== undefined) {
        resolve(body.video)
      } else {
        reject(new Error(body.error?.message ?? `Video upload failed (${request.status})`))
      }
    }
    request.send(file)
  })
}

/** Shared client module used by the input slots and the right-side panel. */
export class VideoClientController {
  private readonly states = new Map<string, VideoClientState>()
  private readonly listeners = new Map<string, Set<() => void>>()

  snapshot(sessionId: string): VideoClientState {
    return this.states.get(sessionId) ?? EMPTY_STATE
  }

  subscribe(sessionId: string, listener: () => void): () => void {
    const listeners = this.listeners.get(sessionId) ?? new Set<() => void>()
    listeners.add(listener)
    this.listeners.set(sessionId, listeners)
    return () => {
      listeners.delete(listener)
      if (listeners.size === 0) this.listeners.delete(sessionId)
    }
  }

  async refresh(sessionId: string): Promise<void> {
    if (sessionId.length === 0) return
    try {
      const response = await fetch(`/vision-bridge/videos?sessionId=${encodeURIComponent(sessionId)}`)
      if (!response.ok) throw await responseError(response)
      const body = await response.json() as { videos?: VideoItem[] }
      this.update(sessionId, { videos: body.videos ?? [], error: undefined })
    } catch (error) {
      this.update(sessionId, { error: error instanceof Error ? error.message : String(error) })
    }
  }

  async upload(sessionId: string, file: File): Promise<void> {
    this.update(sessionId, {
      phase: 'uploading',
      progress: 0,
      activeFileName: file.name,
      error: undefined,
    })
    try {
      const response = await fetch('/vision-bridge/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          fileName: file.name,
          mediaType: file.type || 'application/octet-stream',
          declaredSize: file.size,
        }),
      })
      if (!response.ok) throw await responseError(response)
      const body = await response.json() as { video?: VideoItem }
      if (body.video === undefined) throw new Error('Video upload intent was not created.')
      const uploadUrl = `/vision-bridge/videos/${encodeURIComponent(body.video.videoId)}/upload?sessionId=${encodeURIComponent(sessionId)}`
      const video = await uploadBytes(uploadUrl, file, progress => {
        this.update(sessionId, {
          phase: progress >= 1 ? 'processing' : 'uploading',
          progress,
        })
      })
      this.update(sessionId, {
        videos: [video, ...this.snapshot(sessionId).videos.filter(item => item.videoId !== video.videoId)],
        phase: 'idle',
        progress: 1,
        activeFileName: undefined,
      })
    } catch (error) {
      this.update(sessionId, {
        phase: 'idle',
        progress: 0,
        activeFileName: undefined,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  async delete(sessionId: string, videoId: string): Promise<void> {
    try {
      const response = await fetch(
        `/vision-bridge/videos/${encodeURIComponent(videoId)}?sessionId=${encodeURIComponent(sessionId)}`,
        { method: 'DELETE' },
      )
      if (!response.ok) throw await responseError(response)
      this.update(sessionId, {
        videos: this.snapshot(sessionId).videos.filter(video => video.videoId !== videoId),
        error: undefined,
      })
    } catch (error) {
      this.update(sessionId, { error: error instanceof Error ? error.message : String(error) })
      throw error
    }
  }

  select(sessionId: string, videoId: string): void {
    this.update(sessionId, {
      selection: { token: Date.now() + Math.random(), videoId },
      error: undefined,
    })
  }

  private update(sessionId: string, patch: Partial<VideoClientState>): void {
    this.states.set(sessionId, { ...this.snapshot(sessionId), ...patch })
    for (const listener of this.listeners.get(sessionId) ?? []) listener()
  }
}
