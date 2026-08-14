/**
 * Vision bridge plugin, host half: describe user images through a
 * user-configured OpenAI-compatible vision model when the main model has no
 * vision. Rewrites image blocks only in the adapter's model-bound request
 * copy before serialization (the main route rejects image content),
 * registers the `vision_describe` tool for follow-up asks, serves the
 * connection-test and balance routes the web panel calls, and registers the
 * `deepseek-vision` wrapper adapter so the gateway admits image uploads.
 * @module dsh-visual-plugin
 */
import type { Context } from '@deepseek-ai/cordis';
/** Vision-bridge plugin name. */
export declare const name = "vision-bridge";
/**
 * Required services: the core seams the bridge cannot function without —
 * the tool registry, the settings/credentials seams for the vision endpoint
 * facts, the attachment store for image bytes, the llm registry for the
 * wrapper adapter, and systemPrompt for model guidance. All ship in the base
 * bundle; webServer stays optional because it exists only in web-surface trees.
 */
export declare const inject: string[];
/**
 * The host half: model-bound image description, the describe tool, the panel's
 * HTTP routes, and the wrapper adapter.
 * @param ctx - plugin context.
 */
export declare function apply(ctx: Context): void;
