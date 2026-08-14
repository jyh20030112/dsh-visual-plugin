/**
 * FR0 — vision-enabling wrapper adapter.
 *
 * The harness web gateway rejects image uploads unless the current model's
 * `inputModalities` includes `image` (`MODEL_DOES_NOT_SUPPORT_IMAGES`), and
 * the text-only deepseek serializer throws `UNSUPPORTED_CONTENT` on image
 * blocks. This adapter is registered for the separate `deepseek-vision`
 * provider route: it advertises the underlying deepseek models with `image`
 * added to `inputModalities` (gateway admission), and delegates every stream
 * to the real `deepseek-official` adapter after asynchronously rewriting image
 * blocks in a model-bound copy. Durable session messages keep their original
 * image blocks, so the chat surface remains faithful to what the user sent.
 * The user selects provider
 * "DeepSeek (Vision)" in the Web model picker to enable the bridge.
 * @module dsh-visual-plugin/adapter
 */
import type { Context } from '@deepseek-ai/cordis';
import { type Message } from '@deepseek-ai/dsh-llm';
import type { ModelImageRewriteContext } from './model-messages.ts';
/** The provider route this wrapper owns; users select it in the model picker. */
export declare const VISION_PROVIDER = "deepseek-vision";
/** Async image rewrite performed only for the delegated model request. */
export type VisionMessageRewriter = (messages: readonly Message[], context: ModelImageRewriteContext) => Promise<readonly Message[]>;
/**
 * Register the wrapper adapter for {@link VISION_PROVIDER} when the llm seam
 * is present. The registration is effect-bound and disposes with the fiber.
 * @param ctx - plugin context.
 */
export declare function registerVisionAdapter(ctx: Context, rewrite: VisionMessageRewriter): void;
