/**
 * Vision-bridge user configuration: the OpenAI-compatible vision endpoint the
 * bridge forwards user images to. Lives in the `vision-bridge` settings
 * namespace so the web panel can read and write it through the standard
 * settings seam; the API key itself is a credential reference, never a
 * settings value.
 * @module dsh-visual-plugin/config
 */
import z from '@deepseek-ai/schemastery';
/** The settings namespace this plugin owns. */
export declare const NS: import("@deepseek-ai/dsh-settings").SettingsNamespace;
/** Default credential reference the panel stores the API key under. */
export declare const DEFAULT_API_KEY_ENV = "VISION_API_KEY";
/** Default number of description history entries kept per image. */
export declare const DEFAULT_HISTORY_LIMIT = 20;
/** The `vision-bridge` settings section value. */
export interface VisionBridgeConfigValue {
    /** Base URL of the OpenAI-compatible chat completions API (e.g. `https://api.deepseek.com`). */
    url: string;
    /** Vision-capable model name served by that endpoint (e.g. `glm-4v-flash`). */
    model: string;
    /** Credential reference resolving the API key at each call. */
    apiKeyEnv: string;
    /** Max description-history entries per image; `null` means unlimited, `undefined` the default. */
    historyLimit?: number | null;
}
/** The `vision-bridge` settings section schema. */
export declare const VisionBridgeConfig: z<Schemastery.ObjectS<{
    url: z<string, string>;
    model: z<string, string>;
    apiKeyEnv: z<string, string>;
    historyLimit: z<number, number>;
}>, Schemastery.ObjectT<{
    url: z<string, string>;
    model: z<string, string>;
    apiKeyEnv: z<string, string>;
    historyLimit: z<number, number>;
}>>;
