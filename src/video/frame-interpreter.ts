import { describeImage, describeImages } from '../vision.ts'
import type { FrameInterpreter } from './types.ts'

interface VisionFacts {
  url: string
  apiKey: string
  model: string
}

function base64(data: Uint8Array): string {
  return Buffer.from(data).toString('base64')
}

function timestampedPrompt(
  prompt: string,
  frames: readonly { frameId: string; timestampSeconds: number }[],
): string {
  const timeline = frames
    .map(frame => `${frame.frameId} @ ${frame.timestampSeconds.toFixed(3)}s`)
    .join(', ')
  return `${prompt}\nThe images are chronological video frames: ${timeline}. `
    + 'Describe the observable evidence in temporal order. Attribute changes and visible text to frame ids/timestamps. '
    + 'Do not infer audio or events that are not visible.'
}

function batchUnsupported(error: unknown): boolean {
  const status = (error as { statusCode?: unknown } | null)?.statusCode
  return status === 400 || status === 415 || status === 422
}

/** Bind frame interpretation to the plugin's existing vision configuration. */
export function createVisionFrameInterpreter(
  resolveFacts: () => Promise<VisionFacts | undefined>,
): FrameInterpreter {
  return {
    async describe(request): Promise<string> {
      const facts = await resolveFacts()
      if (facts === undefined) throw new Error('vision model is not configured')
      const prompt = timestampedPrompt(request.prompt, request.frames)
      try {
        const result = await describeImages(
          facts.url,
          facts.apiKey,
          facts.model,
          request.frames.map(frame => ({ data: base64(frame.data), mediaType: frame.mediaType })),
          prompt,
          request.signal,
        )
        return result.description
      } catch (error) {
        if (request.frames.length < 2 || !batchUnsupported(error)) throw error
        const descriptions: string[] = []
        for (const frame of request.frames) {
          request.signal?.throwIfAborted()
          const result = await describeImage(
            facts.url,
            facts.apiKey,
            facts.model,
            base64(frame.data),
            frame.mediaType,
            timestampedPrompt(request.prompt, [frame]),
            request.signal,
          )
          descriptions.push(`[${frame.frameId} @ ${frame.timestampSeconds.toFixed(3)}s] ${result.description}`)
        }
        return descriptions.join('\n')
      }
    },
  }
}
