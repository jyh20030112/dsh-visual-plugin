/**
 * OpenAI-compatible vision calls over the Node fetch global: describe an
 * image, ping a connection, and query a provider's remaining balance.
 * Every request carries `Authorization: Bearer` and never follows redirects
 * (a 3xx is a failure, not a credential leak vector). Errors normalize to a
 * stable code vocabulary the model and the panel can both react to.
 * @module dsh-visual-plugin/vision
 */
/** Maximum milliseconds a vision call may run before aborting. */
export declare const DEFAULT_VISION_TIMEOUT_MS = 60000;
/** One normalized vision-API failure. */
export interface VisionCallError {
    /** Stable code: AUTH, QUOTA, RATE_LIMIT, TIMEOUT, NETWORK, PROTOCOL, HTTP. */
    code: string;
    /** User-safe message with any credential material stripped. */
    message: string;
    /** Provider HTTP status when the failure came from a response. */
    statusCode?: number;
}
/** Result of describing one image. */
export interface VisionDescribeResult {
    /** The vision model's text answer. */
    description: string;
    /** Provider usage report when the response carried one. */
    usage?: VisionUsage;
}
/** Provider-reported token usage, carried through so the panel can show consumption. */
export interface VisionUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
}
/** Result of a connection test. */
export interface VisionTestResult {
    /** Whether the endpoint, key, and model name all worked. */
    ok: boolean;
    /** Round-trip latency in milliseconds for the ping request. */
    latencyMs: number;
    /** Success detail: the model's ping answer (usually "ping"). */
    echo?: string;
    /** Failure detail when not ok. */
    error?: VisionCallError;
}
/** One line of a provider balance report. */
export interface VisionBalanceLine {
    currency: string;
    /** Total granted balance in this currency. */
    total: number;
    /** Remaining available balance. */
    available: number;
    /** What remains after subtracting consumed balance, when reported. */
    used?: number;
}
/** Result of a balance query. */
export interface VisionBalanceResult {
    /** Whether the provider exposes a balance endpoint the bridge knows. */
    supported: boolean;
    /** Parsed balance lines when supported. */
    lines?: VisionBalanceLine[];
    /** Why the query failed or is unsupported. */
    error?: VisionCallError;
}
/**
 * OpenAI-compatible request facts for one image.
 * @param data - base64-encoded image bytes.
 * @param mediaType - image media type, e.g. `image/png`.
 */
export declare function imageDataUrl(data: string, mediaType: string): string;
/**
 * Read a JSON response and normalize a failure to a {@link VisionCallError},
 * sanitizing any echoed credential material.
 * @param url - full chat completions endpoint.
 * @param apiKey - bearer credential.
 * @param model - model name to request.
 * @param messages - OpenAI-format message payload.
 * @param signal - optional abort signal forwarded to the request.
 */
export declare function callChatCompletions(url: string, apiKey: string, model: string, messages: unknown, signal?: AbortSignal): Promise<{
    content: string;
    usage?: VisionUsage;
}>;
/**
 * Ping a chat-completions endpoint with a minimal text prompt.
 * @param baseUrl - endpoint base; `/chat/completions` is appended when absent.
 * @param apiKey - bearer credential.
 * @param model - model name to test.
 * @param signal - optional abort signal.
 */
export declare function testConnection(baseUrl: string, apiKey: string, model: string, signal?: AbortSignal): Promise<VisionTestResult>;
/**
 * Describe one image through an OpenAI-compatible vision endpoint.
 * @param baseUrl - endpoint base; `/chat/completions` is appended when absent.
 * @param apiKey - bearer credential.
 * @param model - vision-capable model name.
 * @param data - base64 image bytes.
 * @param mediaType - image media type.
 * @param prompt - optional instruction overriding the default "describe" ask.
 * @param signal - optional abort signal.
 */
export declare function describeImage(baseUrl: string, apiKey: string, model: string, data: string, mediaType: string, prompt?: string, signal?: AbortSignal): Promise<VisionDescribeResult>;
/**
 * Query a provider's remaining balance when it exposes a known endpoint.
 * Recognized: DeepSeek `/user/balance`, SiliconFlow `/v1/user/info`,
 * Moonshot `/v1/users/me/balance`. Unknown endpoints report unsupported.
 * @param baseUrl - endpoint base used to derive the balance path.
 * @param apiKey - bearer credential.
 * @param signal - optional abort signal.
 */
export declare function queryBalance(baseUrl: string, apiKey: string, signal?: AbortSignal): Promise<VisionBalanceResult>;
