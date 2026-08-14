/**
 * FR0 — vision-enabling wrapper adapter.
 *
 * The harness web gateway rejects image uploads unless the current model's
 * `inputModalities` includes `image` (`MODEL_DOES_NOT_SUPPORT_IMAGES`), and
 * the text-only deepseek serializer throws `UNSUPPORTED_CONTENT` on image
 * blocks. This adapter is registered for the separate `deepseek-vision`
 * provider route: it advertises the underlying deepseek models with `image`
 * added to `inputModalities` (gateway admission), and delegates every stream
 * to the real `deepseek-official` adapter after rewriting any surviving image
 * block into a text placeholder (defensive layer; the pre-step interception
 * in index.ts is the primary rewrite path). The user selects provider
 * "DeepSeek (Vision)" in the Web model picker to enable the bridge.
 * @module dsh-visual-plugin/adapter
 */

import type { Context } from '@deepseek-ai/cordis'
import {
  LlmAdapter,
  type GenerateOptions,
  type ImageBlock,
  type LlmModelInfo,
  type LlmResolvedModelInfo,
  type Message,
  type StreamChunk,
} from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-llm'

/** The provider route this wrapper owns; users select it in the model picker. */
export const VISION_PROVIDER = 'deepseek-vision'

/** The provider route owned by the shipped deepseek adapter. */
const UNDERLYING_PROVIDER = 'deepseek-official'

/**
 * Register the wrapper adapter for {@link VISION_PROVIDER} when the llm seam
 * is present. The registration is effect-bound and disposes with the fiber.
 * @param ctx - plugin context.
 */
export function registerVisionAdapter(ctx: Context): void {
  const llm = ctx.get('llm')
  if (llm === undefined) return
  llm.registerAdapter([VISION_PROVIDER], new VisionBridgeAdapter(ctx))
}

/** The wrapper: image-input admission plus delegated deepseek streaming. */
class VisionBridgeAdapter extends LlmAdapter {
  constructor(private readonly ctx: Context) {
    super()
  }

  override providerInfo(provider: string): { id: string; name: string } {
    return { id: provider, name: 'DeepSeek (Vision)' }
  }

  override listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    return this.ctx.llm.listModels(UNDERLYING_PROVIDER).then(models =>
      models.map(model => ({ ...model, provider })),
    )
  }

  override resolveModel(
    provider: string,
    model: string,
    signal?: AbortSignal,
  ): Promise<LlmResolvedModelInfo> {
    return this.ctx.llm.resolveModelInfo(UNDERLYING_PROVIDER, model, signal).then(info => ({
      ...info,
      // The delegated metadata carries the underlying route's provider id;
      // this wrapper owns the `deepseek-vision` route, so rebrand it (the
      // runtime rejects metadata whose provider does not match the route).
      provider,
      inputModalities: [...(info.inputModalities ?? []), 'image'],
    }))
  }

  override async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    const rewritten = rewriteImageBlocks(options.messages)
    const delegated: GenerateOptions = rewritten === options.messages
      ? { ...options, provider: UNDERLYING_PROVIDER }
      : { ...options, provider: UNDERLYING_PROVIDER, messages: rewritten as Message[] }
    yield* this.ctx.llm.stream(delegated)
  }
}

/** Replace every image block with a text placeholder the model can act on. */
function rewriteImageBlocks(messages: readonly Message[]): readonly Message[] {
  let changed = false
  const rewritten = messages.map((message) => {
    if (!message.content.some(block => block.type === 'image')) return message
    changed = true
    return {
      ...message,
      content: message.content.map((block) => block.type === 'image'
        ? {
            type: 'text' as const,
            text: `<image attachmentId="${(block as ImageBlock).attachment.attachmentId}">`,
          }
        : block),
    }
  })
  return changed ? rewritten : messages
}
