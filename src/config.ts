/**
 * Vision-bridge user configuration: the OpenAI-compatible vision endpoint the
 * bridge forwards user images to. Lives in the `vision-bridge` settings
 * namespace so the web panel can read and write it through the standard
 * settings seam; the API key itself is a credential reference, never a
 * settings value.
 * @module dsh-visual-plugin/config
 */

import z from '@deepseek-ai/schemastery'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'

/** The settings namespace this plugin owns. */
export const NS = settingsNamespace('vision-bridge')

/** Default credential reference the panel stores the API key under. */
export const DEFAULT_API_KEY_ENV = 'VISION_API_KEY'

/** Default number of description history entries kept per image. */
export const DEFAULT_HISTORY_LIMIT = 20

/** The `vision-bridge` settings section value. */
export interface VisionBridgeConfigValue {
  /** Base URL of the OpenAI-compatible chat completions API (e.g. `https://api.deepseek.com`). */
  url: string
  /** Vision-capable model name served by that endpoint (e.g. `glm-4v-flash`). */
  model: string
  /** Credential reference resolving the API key at each call. */
  apiKeyEnv: string
  /** Max description-history entries per image; `null` means unlimited, `undefined` the default. */
  historyLimit?: number | null
}

/** The `vision-bridge` settings section schema. */
export const VisionBridgeConfig = z.object({
  url: z.string().default(''),
  model: z.string().default(''),
  apiKeyEnv: z.string().role('credential-ref').default(DEFAULT_API_KEY_ENV),
  historyLimit: z.number(),
})
