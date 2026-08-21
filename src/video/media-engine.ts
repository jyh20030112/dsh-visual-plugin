import type {
  MediaEngine,
  MediaPrepareRequest,
  PreparedFrame,
  PreparedVideo,
  VideoCapabilityReport,
} from './types.ts'
import { copyFile, mkdir, rename } from 'node:fs/promises'
import { join } from 'node:path'
import { inspectVideo, type VideoProbe } from './probe.ts'
import { runCommand, type CommandRunner } from './process-runner.ts'
import { sceneTimestamps } from './scenes.ts'

const MIN_FFMPEG = [6, 1] as const
const MIN_SCENEDETECT = [0, 7, 1] as const
const MAX_SCENEDETECT = [0, 8, 0] as const

export interface SystemMediaEngineOptions {
  run?: CommandRunner
  ffmpegPath?: string
  ffprobePath?: string
  sceneDetectPath?: string
}

function versionOf(text: string): string | undefined {
  return text.match(/\b(?:version\s+|PySceneDetect\s+)(?:n)?(\d+\.\d+(?:\.\d+)?)/i)?.[1]
}

function versionParts(version: string): [number, number, number] {
  const values = version.split('.').map(Number)
  return [values[0] ?? 0, values[1] ?? 0, values[2] ?? 0]
}

function compareVersion(left: readonly number[], right: readonly number[]): number {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

function containsWord(output: string, value: string): boolean {
  return new RegExp(`(?:^|\\s)${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|$)`, 'm').test(output)
}

function seekTimestamp(seconds: number): string {
  const milliseconds = Math.floor(Math.max(0, seconds) * 1_000)
  return (milliseconds / 1_000).toFixed(3)
}

class SystemMediaEngine implements MediaEngine {
  private readonly run: CommandRunner
  private readonly ffmpeg: string
  private readonly ffprobe: string
  private readonly sceneDetect: string

  constructor(options: SystemMediaEngineOptions) {
    this.run = options.run ?? runCommand
    this.ffmpeg = options.ffmpegPath ?? 'ffmpeg'
    this.ffprobe = options.ffprobePath ?? 'ffprobe'
    this.sceneDetect = options.sceneDetectPath ?? 'scenedetect'
  }

  async health(): Promise<VideoCapabilityReport> {
    const [ffmpegVersionCall, ffprobeVersionCall, sceneVersionCall, encodersCall, filtersCall] = await Promise.all([
      this.run(this.ffmpeg, ['-version'], { timeoutMs: 15_000 }),
      this.run(this.ffprobe, ['-version'], { timeoutMs: 15_000 }),
      this.run(this.sceneDetect, ['version'], { timeoutMs: 15_000 }),
      this.run(this.ffmpeg, ['-hide_banner', '-encoders'], { timeoutMs: 15_000 }),
      this.run(this.ffmpeg, ['-hide_banner', '-filters'], { timeoutMs: 15_000 }),
    ])
    const ffmpegVersion = ffmpegVersionCall.exitCode === 0 ? versionOf(ffmpegVersionCall.stdout) : undefined
    const ffprobeVersion = ffprobeVersionCall.exitCode === 0 ? versionOf(ffprobeVersionCall.stdout) : undefined
    const sceneVersion = sceneVersionCall.exitCode === 0 ? versionOf(sceneVersionCall.stdout) : undefined
    const encoders = `${encodersCall.stdout}\n${encodersCall.stderr}`
    const filters = `${filtersCall.stdout}\n${filtersCall.stderr}`
    const features = {
      libx264: containsWord(encoders, 'libx264'),
      nvenc: containsWord(encoders, 'h264_nvenc'),
      hdrToneMap: containsWord(filters, 'zscale') && containsWord(filters, 'tonemap'),
      deinterlace: containsWord(filters, 'bwdif'),
    }
    const issues: VideoCapabilityReport['issues'] = []

    if (ffmpegVersion === undefined) {
      issues.push({ code: 'ffmpeg_unavailable', message: 'FFmpeg was not found or did not report a version.' })
    } else if (compareVersion(versionParts(ffmpegVersion), MIN_FFMPEG) < 0) {
      issues.push({ code: 'ffmpeg_too_old', message: `FFmpeg ${ffmpegVersion} is older than 6.1.` })
    }
    if (ffprobeVersion === undefined) {
      issues.push({ code: 'ffprobe_unavailable', message: 'FFprobe was not found or did not report a version.' })
    } else if (compareVersion(versionParts(ffprobeVersion), MIN_FFMPEG) < 0) {
      issues.push({ code: 'ffprobe_too_old', message: `FFprobe ${ffprobeVersion} is older than 6.1.` })
    }
    if (ffmpegVersion !== undefined && ffprobeVersion !== undefined
      && versionParts(ffmpegVersion)[0] !== versionParts(ffprobeVersion)[0]) {
      issues.push({ code: 'ffmpeg_ffprobe_mismatch', message: 'FFmpeg and FFprobe must use the same major version.' })
    }
    if (!features.libx264) {
      issues.push({ code: 'libx264_unavailable', message: 'FFmpeg does not expose the libx264 encoder.' })
    }
    if (sceneVersion === undefined) {
      issues.push({ code: 'scenedetect_unavailable', message: 'PySceneDetect was not found on PATH.' })
    } else if (compareVersion(versionParts(sceneVersion), MIN_SCENEDETECT) < 0
      || compareVersion(versionParts(sceneVersion), MAX_SCENEDETECT) >= 0) {
      issues.push({
        code: 'scenedetect_unsupported_version',
        message: `PySceneDetect ${sceneVersion} is outside the supported >=0.7.1 <0.8 range.`,
      })
    } else {
      const [adaptive, threshold] = await Promise.all([
        this.run(this.sceneDetect, ['help', 'detect-adaptive'], { timeoutMs: 15_000 }),
        this.run(this.sceneDetect, ['help', 'detect-threshold'], { timeoutMs: 15_000 }),
      ])
      if (adaptive.exitCode !== 0 || threshold.exitCode !== 0) {
        issues.push({ code: 'scenedetect_commands_unavailable', message: 'Required scene detectors are unavailable.' })
      }
    }

    return {
      available: issues.length === 0,
      ...(ffmpegVersion === undefined ? {} : { ffmpeg: { version: ffmpegVersion } }),
      ...(ffprobeVersion === undefined ? {} : { ffprobe: { version: ffprobeVersion } }),
      ...(sceneVersion === undefined ? {} : { sceneDetect: { version: sceneVersion } }),
      features,
      issues,
    }
  }

  async prepare(request: MediaPrepareRequest): Promise<PreparedVideo> {
    const health = await this.health()
    if (!health.available) {
      const error = new Error(health.issues.map(issue => issue.message).join(' ')) as Error & { code?: string }
      error.code = 'video_dependencies_unavailable'
      throw error
    }
    await mkdir(request.outputDir, { recursive: true })
    await request.onStatus('validating')
    const input = await inspectVideo({
      path: request.sourceFile,
      originalFileName: request.originalFileName,
      ffprobe: this.ffprobe,
      run: this.run,
      ...(request.signal === undefined ? {} : { signal: request.signal }),
    })
    if (input.stream.hdr && !health.features.hdrToneMap) {
      const error = new Error('HDR input requires FFmpeg zscale and tonemap filters.') as Error & { code?: string }
      error.code = 'hdr_filters_unavailable'
      throw error
    }

    await request.onStatus('transcoding')
    const partial = join(request.outputDir, 'normalized.part.mp4')
    const normalized = join(request.outputDir, 'normalized.mp4')
    const filters = this.filtersFor(input)
    await this.checked(this.ffmpeg, [
      '-hide_banner', '-nostdin', '-y',
      '-i', request.sourceFile,
      '-map', `0:${input.stream.index}`,
      '-an', '-sn', '-dn', '-map_metadata', '-1',
      '-vf', filters.join(','),
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '26',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      partial,
    ], request.signal, Math.min(30 * 60_000, Math.max(120_000, input.durationSeconds * 4_000)))
    const output = await inspectVideo({
      path: partial,
      originalFileName: 'normalized.mp4',
      ffprobe: this.ffprobe,
      run: this.run,
      maxDurationSeconds: 2 * 60 * 60,
      maxDimension: 1280,
      ...(request.signal === undefined ? {} : { signal: request.signal }),
    })
    this.verifyOutput(input, output)
    await rename(partial, normalized)

    await request.onStatus('detecting')
    const timestamps = await sceneTimestamps({
      executable: this.sceneDetect,
      input: normalized,
      outputDir: request.outputDir,
      durationSeconds: output.durationSeconds,
      limit: 48,
      run: this.run,
      ...(request.signal === undefined ? {} : { signal: request.signal }),
    })

    await request.onStatus('extracting')
    const frames: PreparedFrame[] = []
    for (const [index, timestampSeconds] of timestamps.entries()) {
      const frameId = `F${String(index + 1).padStart(2, '0')}`
      const file = `frame-${frameId}.jpg`
      const highResolutionFile = `frame-${frameId}-hq.jpg`
      await this.extractFrame(normalized, join(request.outputDir, file), timestampSeconds, 0, request.signal)
      await this.extractFrame(
        request.sourceFile,
        join(request.outputDir, highResolutionFile),
        timestampSeconds,
        input.stream.index,
        request.signal,
      )
      frames.push({ frameId, timestampSeconds, file, highResolutionFile })
    }
    if (frames.length === 0) throw new Error('video preparation produced no keyframes')
    await copyFile(join(request.outputDir, frames[0].file), join(request.outputDir, 'poster.jpg'))
    return {
      normalizedFile: 'normalized.mp4',
      posterFile: 'poster.jpg',
      durationSeconds: output.durationSeconds,
      width: output.stream.width,
      height: output.stream.height,
      frames,
      warnings: [
        'audio_not_analyzed',
        ...(input.stream.alpha ? ['alpha_flattened'] : []),
        ...(input.stream.interlaced ? ['deinterlaced'] : []),
        ...(input.stream.hdr ? ['hdr_tone_mapped'] : []),
      ],
      sceneEngine: 'pyscenedetect',
    }
  }

  async extractRange(_request: {
    videoId: string
    normalizedFile: string
    outputDir: string
    startSeconds?: number
    endSeconds?: number
    limit: number
    signal?: AbortSignal
  }): Promise<PreparedFrame[]> {
    throw new Error('system range extraction is not implemented')
  }

  private filtersFor(input: VideoProbe): string[] {
    return [
      ...(input.stream.interlaced ? ['bwdif=mode=send_frame:parity=auto:deint=interlaced'] : []),
      ...(input.stream.alpha ? [
        'format=rgba',
        "geq=r='r(X,Y)*alpha(X,Y)/255+128*(1-alpha(X,Y)/255)'"
          + ":g='g(X,Y)*alpha(X,Y)/255+128*(1-alpha(X,Y)/255)'"
          + ":b='b(X,Y)*alpha(X,Y)/255+128*(1-alpha(X,Y)/255)':a=255",
      ] : []),
      ...(input.stream.hdr
        ? ['zscale=t=linear:npl=100', 'format=gbrpf32le', 'zscale=p=bt709', 'tonemap=hable:desat=0', 'zscale=t=bt709:m=bt709:r=tv']
        : []),
      "scale=w='if(gt(iw,ih),min(1280,iw),-2)':h='if(gt(iw,ih),-2,min(1280,ih))':force_original_aspect_ratio=decrease:force_divisible_by=2",
      'setsar=1',
      'fps=15',
      'format=yuv420p',
    ]
  }

  private verifyOutput(input: VideoProbe, output: VideoProbe): void {
    if (output.family !== 'iso-bmff' || output.stream.codecName !== 'h264' || output.stream.pixelFormat !== 'yuv420p') {
      throw new Error('normalized output is not MP4/H.264/yuv420p')
    }
    if (output.stream.width > 1280 || output.stream.height > 1280
      || output.stream.width % 2 !== 0 || output.stream.height % 2 !== 0
      || output.stream.frameRate > 15.01) {
      throw new Error('normalized output violates dimension or frame-rate limits')
    }
    const tolerance = Math.max(1, input.durationSeconds * 0.01)
    if (Math.abs(input.durationSeconds - output.durationSeconds) > tolerance) {
      throw new Error('normalized output duration differs from the input')
    }
  }

  private async extractFrame(
    input: string,
    output: string,
    timestampSeconds: number,
    streamIndex: number,
    signal?: AbortSignal,
  ): Promise<void> {
    await this.checked(this.ffmpeg, [
      '-hide_banner', '-nostdin', '-y', '-ss', seekTimestamp(timestampSeconds), '-i', input,
      '-map', `0:${streamIndex}`, '-frames:v', '1', '-q:v', '3', output,
    ], signal, 60_000)
  }

  private async checked(
    executable: string,
    args: readonly string[],
    signal: AbortSignal | undefined,
    timeoutMs: number,
  ): Promise<void> {
    const result = await this.run(executable, args, { timeoutMs, ...(signal === undefined ? {} : { signal }) })
    if (result.exitCode !== 0) {
      const error = new Error(result.stderr.trim() || `${executable} exited with code ${result.exitCode}`) as Error & { code?: string }
      error.code = 'media_command_failed'
      throw error
    }
  }
}

/** Create the production FFmpeg/PySceneDetect adapter with injectable command execution for tests. */
export function createSystemMediaEngine(options: SystemMediaEngineOptions = {}): MediaEngine {
  return new SystemMediaEngine(options)
}
