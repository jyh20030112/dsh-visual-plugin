import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { WebServer } from '@deepseek-ai/dsh-host-webserver'
import type { VideoContent, VideoCoordinator } from './types.ts'

interface VideoRouteOptions {
  sessionExists(sessionId: string): boolean
}

function writeJson(res: ServerResponse, value: unknown, status = 200): void {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'X-Content-Type-Options': 'nosniff',
  })
  res.end(body)
}

async function readJson(req: IncomingMessage, limit = 64 * 1024): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const value of req) {
    const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value)
    size += chunk.byteLength
    if (size > limit) throw codedError('request_too_large', 'Request metadata is too large.')
    chunks.push(chunk)
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('object required')
    return parsed as Record<string, unknown>
  } catch (error) {
    if ((error as { code?: unknown }).code === 'request_too_large') throw error
    throw codedError('invalid_json', 'Request body must be a JSON object.')
  }
}

function codedError(code: string, message: string): Error {
  const error = new Error(message) as Error & { code?: string }
  error.code = code
  return error
}

function stringField(value: Record<string, unknown>, key: string): string {
  if (typeof value[key] !== 'string') throw codedError('invalid_request', `${key} must be a string`)
  return value[key] as string
}

function numberField(value: Record<string, unknown>, key: string): number {
  if (typeof value[key] !== 'number') throw codedError('invalid_request', `${key} must be a number`)
  return value[key] as number
}

function sameOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin
  const host = req.headers.host
  if (origin === undefined || host === undefined) return false
  try {
    const url = new URL(origin)
    return url.host === host && (url.protocol === 'http:' || url.protocol === 'https:')
  } catch {
    return false
  }
}

function statusFor(error: unknown): number {
  switch ((error as { code?: unknown } | null)?.code) {
    case 'video_not_found': return 404
    case 'upload_too_large':
    case 'request_too_large': return 413
    case 'invalid_video_state': return 409
    case 'video_dependencies_unavailable': return 503
    case 'storage_quota_exceeded': return 507
    default: return 400
  }
}

function rangeOf(header: string | undefined, size: number): { start: number; end: number } | undefined | null {
  if (header === undefined) return undefined
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (match === null || (match[1] === '' && match[2] === '')) return null
  let start: number
  let end: number
  if (match[1] === '') {
    const suffix = Number(match[2])
    if (!Number.isSafeInteger(suffix) || suffix < 1) return null
    start = Math.max(0, size - suffix)
    end = size - 1
  } else {
    start = Number(match[1])
    end = match[2] === '' ? size - 1 : Number(match[2])
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) return null
  return { start, end: Math.min(end, size - 1) }
}

async function sendContent(req: IncomingMessage, res: ServerResponse, content: VideoContent): Promise<void> {
  const range = rangeOf(typeof req.headers.range === 'string' ? req.headers.range : undefined, content.sizeBytes)
  if (range === null) {
    res.writeHead(416, { 'Content-Range': `bytes */${content.sizeBytes}`, 'Accept-Ranges': 'bytes' })
    res.end()
    return
  }
  const headers: Record<string, string | number> = {
    'Content-Type': content.mediaType,
    'Content-Disposition': 'inline',
    'Accept-Ranges': 'bytes',
    'ETag': content.etag,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-cache',
  }
  if (range === undefined) {
    headers['Content-Length'] = content.sizeBytes
    res.writeHead(200, headers)
  } else {
    headers['Content-Length'] = range.end - range.start + 1
    headers['Content-Range'] = `bytes ${range.start}-${range.end}/${content.sizeBytes}`
    res.writeHead(206, headers)
  }
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  await pipeline(Readable.from(content.open(range ?? undefined)), res)
}

/** Register the complete same-origin HTTP adapter over the coordinator interface. */
export function registerVideoRoutes(
  webServer: Pick<WebServer, 'register'>,
  coordinator: VideoCoordinator,
  options: VideoRouteOptions,
): () => void {
  return webServer.register({
    kind: 'prefix',
    path: '/vision-bridge/videos',
    async handler(req, res) {
      const url = new URL(req.url ?? '/vision-bridge/videos', `http://${req.headers.host ?? 'localhost'}`)
      const segments = url.pathname.split('/').filter(Boolean)
      try {
        if (req.method === 'GET' && url.pathname === '/vision-bridge/videos/health') {
          writeJson(res, await coordinator.health())
          return
        }
        if (req.method === 'GET' && url.pathname === '/vision-bridge/videos') {
          const sessionId = url.searchParams.get('sessionId') ?? ''
          if (!options.sessionExists(sessionId)) throw codedError('video_not_found', 'Session was not found.')
          writeJson(res, { videos: await coordinator.list(sessionId) })
          return
        }
        if (req.method === 'POST' && url.pathname === '/vision-bridge/videos') {
          if (!sameOrigin(req)) throw codedError('origin_rejected', 'A same-origin request is required.')
          const body = await readJson(req)
          const sessionId = stringField(body, 'sessionId')
          if (!options.sessionExists(sessionId)) throw codedError('video_not_found', 'Session was not found.')
          const video = await coordinator.createUpload({
            sessionId,
            fileName: stringField(body, 'fileName'),
            mediaType: stringField(body, 'mediaType'),
            declaredSize: numberField(body, 'declaredSize'),
          })
          writeJson(res, { video }, 201)
          return
        }
        const videoId = segments.length >= 3 ? decodeURIComponent(segments[2]) : ''
        const operation = segments[3]
        if (req.method === 'PUT' && operation === 'upload') {
          if (!sameOrigin(req)) throw codedError('origin_rejected', 'A same-origin request is required.')
          const sessionId = url.searchParams.get('sessionId') ?? ''
          const controller = new AbortController()
          req.once('aborted', () => controller.abort())
          const video = await coordinator.writeUpload({
            videoId,
            sessionId,
            body: req,
            signal: controller.signal,
          })
          writeJson(res, { video })
          return
        }
        if ((req.method === 'GET' || req.method === 'HEAD') && (operation === 'content' || operation === 'poster')) {
          await sendContent(req, res, await coordinator.content(videoId, operation === 'content' ? 'video' : 'poster'))
          return
        }
        if (req.method === 'DELETE' && segments.length === 3) {
          if (!sameOrigin(req)) throw codedError('origin_rejected', 'A same-origin request is required.')
          const sessionId = url.searchParams.get('sessionId') ?? ''
          await coordinator.delete(sessionId, videoId)
          res.writeHead(204)
          res.end()
          return
        }
        writeJson(res, { error: { code: 'not_found', message: 'Video route was not found.' } }, 404)
      } catch (error) {
        if (res.headersSent) {
          res.destroy(error instanceof Error ? error : undefined)
          return
        }
        writeJson(res, {
          error: {
            code: String((error as { code?: unknown } | null)?.code ?? 'video_request_failed'),
            message: error instanceof Error ? error.message : String(error),
          },
        }, statusFor(error))
      }
    },
  })
}
