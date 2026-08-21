import { open } from 'node:fs/promises'
import { extname } from 'node:path'
import type { CommandRunner } from './process-runner.ts'

export type ContainerFamily = 'iso-bmff' | 'avi' | 'mpeg-ps' | 'matroska' | 'webm'

export interface VideoStreamProbe {
  index: number
  codecName: string
  pixelFormat: string
  width: number
  height: number
  frameRate: number
  hdr: boolean
  interlaced: boolean
  alpha: boolean
}

export interface VideoProbe {
  family: ContainerFamily
  durationSeconds: number
  stream: VideoStreamProbe
  hasAudio: boolean
}

interface RawStream {
  index?: number
  codec_type?: string
  codec_name?: string
  pix_fmt?: string
  width?: number
  height?: number
  avg_frame_rate?: string
  r_frame_rate?: string
  field_order?: string
  color_transfer?: string
  disposition?: { default?: number; attached_pic?: number }
  tags?: Record<string, string>
}

interface RawProbe {
  format?: { format_name?: string; duration?: string; tags?: Record<string, string> }
  streams?: RawStream[]
}

function videoError(code: string, message: string): Error {
  const error = new Error(message) as Error & { code?: string }
  error.code = code
  return error
}

function extensionFamily(fileName: string): ContainerFamily | undefined {
  switch (extname(fileName).toLowerCase()) {
    case '.mp4':
    case '.m4v':
    case '.mov': return 'iso-bmff'
    case '.avi': return 'avi'
    case '.mpg':
    case '.mpeg': return 'mpeg-ps'
    case '.mkv': return 'matroska'
    case '.webm': return 'webm'
    default: return undefined
  }
}

async function signatureFamily(path: string): Promise<ContainerFamily | undefined> {
  const handle = await open(path, 'r')
  try {
    const buffer = Buffer.alloc(4096)
    const { bytesRead } = await handle.read(buffer, 0, buffer.byteLength, 0)
    const bytes = buffer.subarray(0, bytesRead)
    if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'AVI ') {
      return 'avi'
    }
    if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
      const lower = bytes.toString('latin1').toLowerCase()
      if (lower.includes('webm')) return 'webm'
      if (lower.includes('matroska')) return 'matroska'
    }
    for (let offset = 4; offset + 4 <= bytes.length && offset <= 1024; offset += 4) {
      if (bytes.toString('ascii', offset, offset + 4) === 'ftyp') return 'iso-bmff'
    }
    if (bytes.length >= 4 && bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1
      && (bytes[3] === 0xba || bytes[3] === 0xbb || bytes[3] === 0xb3)) return 'mpeg-ps'
    return undefined
  } finally {
    await handle.close()
  }
}

function probedFamily(formatName: string, signature: ContainerFamily | undefined): ContainerFamily | undefined {
  const names = new Set(formatName.split(','))
  if (names.has('mov') || names.has('mp4')) return 'iso-bmff'
  if (names.has('avi')) return 'avi'
  if (names.has('mpeg')) return 'mpeg-ps'
  if (names.has('matroska') || names.has('webm')) {
    return signature === 'webm' ? 'webm' : signature === 'matroska' ? 'matroska' : undefined
  }
  return undefined
}

function rateOf(value: string | undefined): number {
  if (value === undefined) return 0
  const [numerator, denominator = '1'] = value.split('/')
  const rate = Number(numerator) / Number(denominator)
  return Number.isFinite(rate) ? rate : 0
}

function selectVideoStream(streams: RawStream[]): RawStream {
  const videos = streams.filter(stream => stream.codec_type === 'video' && stream.disposition?.attached_pic !== 1)
  if (videos.length === 1) return videos[0]
  const defaults = videos.filter(stream => stream.disposition?.default === 1)
  if (defaults.length === 1) return defaults[0]
  if (videos.length === 0) throw videoError('video_stream_missing', 'The container has no decodable video stream.')
  throw videoError('multiple_video_streams', 'The container has multiple video streams and no unique default stream.')
}

/** Inspect an untrusted local upload and cross-check its declared container family. */
export async function inspectVideo(options: {
  path: string
  originalFileName: string
  ffprobe: string
  run: CommandRunner
  signal?: AbortSignal
  maxDurationSeconds?: number
  maxDimension?: number
}): Promise<VideoProbe> {
  const extension = extensionFamily(options.originalFileName)
  if (extension === undefined) throw videoError('unsupported_container', 'The video filename has an unsupported extension.')
  const signature = await signatureFamily(options.path)
  if (signature === undefined) throw videoError('unsupported_container', 'The file signature is not a supported video container.')
  const result = await options.run(options.ffprobe, [
    '-v', 'error', '-show_format', '-show_streams', '-of', 'json', options.path,
  ], { timeoutMs: 15_000, ...(options.signal === undefined ? {} : { signal: options.signal }) })
  if (result.exitCode !== 0) throw videoError('invalid_video', result.stderr.trim() || 'FFprobe could not inspect the video.')
  let raw: RawProbe
  try {
    raw = JSON.parse(result.stdout) as RawProbe
  } catch {
    throw videoError('invalid_video', 'FFprobe returned invalid metadata.')
  }
  const probed = probedFamily(raw.format?.format_name ?? '', signature)
  if (probed === undefined) throw videoError('unsupported_container', 'FFprobe identified an unsupported video container.')
  if (extension !== signature || extension !== probed) {
    throw videoError('container_mismatch', 'The filename, file signature, and detected container do not agree.')
  }
  const durationSeconds = Number(raw.format?.duration)
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw videoError('invalid_duration', 'The video duration must be greater than zero.')
  }
  if (durationSeconds > (options.maxDurationSeconds ?? 600)) {
    throw videoError('duration_limit', 'The video exceeds the configured duration limit.')
  }
  const selected = selectVideoStream(raw.streams ?? [])
  const width = Number(selected.width)
  const height = Number(selected.height)
  if (!Number.isSafeInteger(width) || width < 1 || !Number.isSafeInteger(height) || height < 1) {
    throw videoError('invalid_dimensions', 'The selected video stream has invalid dimensions.')
  }
  const maxDimension = options.maxDimension ?? 4096
  if (width > maxDimension || height > maxDimension) {
    throw videoError('resolution_limit', 'The video exceeds the configured resolution limit.')
  }
  const tags = { ...raw.format?.tags, ...selected.tags }
  if (Object.keys(tags).some(key => /encrypt|drm/i.test(key))) {
    throw videoError('protected_video', 'Encrypted or DRM-protected video is not supported.')
  }
  const pixelFormat = selected.pix_fmt ?? ''
  const transfer = selected.color_transfer?.toLowerCase() ?? ''
  return {
    family: probed,
    durationSeconds,
    stream: {
      index: selected.index ?? 0,
      codecName: selected.codec_name ?? '',
      pixelFormat,
      width,
      height,
      frameRate: rateOf(selected.avg_frame_rate ?? selected.r_frame_rate),
      hdr: transfer === 'smpte2084' || transfer === 'arib-std-b67',
      interlaced: selected.field_order !== undefined
        && selected.field_order !== 'progressive'
        && selected.field_order !== 'unknown',
      alpha: /(^|a)(yuva|rgba|argb|bgra|gbrap|ya)/i.test(pixelFormat),
    },
    hasAudio: (raw.streams ?? []).some(stream => stream.codec_type === 'audio'),
  }
}
