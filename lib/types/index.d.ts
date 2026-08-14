/**
 * Vision bridge plugin, host half: describe user images through a
 * user-configured OpenAI-compatible vision model when the main model has no
 * vision. Intercepts `agent/pre-step` to replace image blocks with text
 * descriptions before serialization (the main route rejects image content),
 * registers the `vision.describe` tool for follow-up asks, serves the
 * connection-test and balance routes the web panel calls, and registers the
 * `deepseek-vision` wrapper adapter so the gateway admits image uploads.
 * @module dsh-visual-plugin
 */
import type { Context } from '@deepseek-ai/cordis';
/** Vision-bridge plugin name. */
export declare const name = "vision-bridge";
/** Required services: the tool registry only; every other seam is optional. */
export declare const inject: string[];
/**
 * The host half: pre-step image interception, the describe tool, the panel's
 * HTTP routes, and the wrapper adapter.
 * @param ctx - plugin context.
 */
export declare function apply(ctx: Context): void;
