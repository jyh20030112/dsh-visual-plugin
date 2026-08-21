/**
 * OpenAI-compatible vision calls over the Node fetch global: describe an
 * image, ping a connection, and query a provider's remaining balance.
 * Every request carries `Authorization: Bearer` and never follows redirects
 * (a 3xx is a failure, not a credential leak vector). Errors normalize to a
 * stable code vocabulary the model and the panel can both react to.
 * @module dsh-visual-plugin/vision
 */

/** Maximum milliseconds a vision call may run before aborting. */
export const DEFAULT_VISION_TIMEOUT_MS = 60_000

/** One normalized vision-API failure. */
export interface VisionCallError {
  /** Stable code: AUTH, QUOTA, RATE_LIMIT, TIMEOUT, NETWORK, PROTOCOL, HTTP. */
  code: string
  /** User-safe message with any credential material stripped. */
  message: string
  /** Provider HTTP status when the failure came from a response. */
  statusCode?: number
}

/** Result of describing one image. */
export interface VisionDescribeResult {
  /** The vision model's text answer. */
  description: string
  /** Provider usage report when the response carried one. */
  usage?: VisionUsage
}

/** Provider-reported token usage, carried through so the panel can show consumption. */
export interface VisionUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

/** Result of a connection test. */
export interface VisionTestResult {
  /** Whether the endpoint, key, and model name all worked. */
  ok: boolean
  /** Round-trip latency in milliseconds for the ping request. */
  latencyMs: number
  /** Success detail: the model's ping answer (usually "ping"). */
  echo?: string
  /** Failure detail when not ok. */
  error?: VisionCallError
}

/** One line of a provider balance report. */
export interface VisionBalanceLine {
  currency: string
  /** Total granted balance in this currency. */
  total: number
  /** Remaining available balance. */
  available: number
  /** What remains after subtracting consumed balance, when reported. */
  used?: number
}

/** Result of a balance query. */
export interface VisionBalanceResult {
  /** Whether the provider exposes a balance endpoint the bridge knows. */
  supported: boolean
  /** Parsed balance lines when supported. */
  lines?: VisionBalanceLine[]
  /** Why the query failed or is unsupported. */
  error?: VisionCallError
}

/** Internal marker so callers can rethrow the normalized form. */
class VisionError extends Error {
  readonly code: string
  readonly statusCode: number | undefined

  constructor(code: string, message: string, statusCode?: number) {
    super(message)
    this.code = code
    this.statusCode = statusCode
  }
}

/** Stable error vocabulary for vision-API failures. */
const CODE_FOR_STATUS: Record<number, string> = {
  401: 'AUTH',
  403: 'AUTH',
  429: 'RATE_LIMIT',
  402: 'QUOTA',
}

/** Extract a safe message from an unknown thrown value. */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Build a normalized error with optional provider body details. */
function visionError(code: string, message: string, statusCode?: number, body?: string): VisionError {
  const detail = statusCode === undefined
    ? message
    : `${message}${body === undefined || body.length === 0 ? '' : ` Body: ${body}`}`
  return new VisionError(code, detail, statusCode)
}

/** Parse a non-2xx response into a normalized {@link VisionCallError}. */
async function httpError(response: Response): Promise<VisionError> {
  const statusCode = response.status
  const code = CODE_FOR_STATUS[statusCode] ?? 'HTTP'
  let body = ''
  try {
    body = (await response.text()).slice(0, 500)
  } catch {
    // Body read failure is not the reported error; keep the status line.
  }
  return visionError(code, `Vision API returned HTTP ${statusCode}.`, statusCode, body)
}

/** Normalize any thrown value to a {@link VisionCallError}. */
function normalize(error: unknown): VisionCallError {
  if (error instanceof VisionError) {
    const normalized: VisionCallError = { code: error.code, message: error.message }
    if (error.statusCode !== undefined) normalized.statusCode = error.statusCode
    return normalized
  }
  return { code: 'NETWORK', message: errorMessage(error) }
}

/** Append `/chat/completions` to a base URL that does not already end there. */
function completionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '')
  return trimmed.endsWith('/chat/completions') ? trimmed : `${trimmed}/chat/completions`
}

/** Coerce an unknown JSON number field, defaulting when absent or non-numeric. */
function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/**
 * OpenAI-compatible request facts for one image.
 * @param data - base64-encoded image bytes.
 * @param mediaType - image media type, e.g. `image/png`.
 */
export function imageDataUrl(data: string, mediaType: string): string {
  return `data:${mediaType};base64,${data}`
}

/**
 * Read a JSON response and normalize a failure to a {@link VisionCallError},
 * sanitizing any echoed credential material.
 * @param url - full chat completions endpoint.
 * @param apiKey - bearer credential.
 * @param model - model name to request.
 * @param messages - OpenAI-format message payload.
 * @param signal - optional abort signal forwarded to the request.
 */
export async function callChatCompletions(
  url: string,
  apiKey: string,
  model: string,
  messages: unknown,
  signal?: AbortSignal,
): Promise<{ content: string; usage?: VisionUsage }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DEFAULT_VISION_TIMEOUT_MS)
  const onOuterAbort = () => controller.abort()
  signal?.addEventListener('abort', onOuterAbort, { once: true })
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages, max_tokens: 1024 }),
      redirect: 'manual',
      signal: controller.signal,
    })
    if (response.status >= 300) throw await httpError(response)
    const json = await response.json() as { choices?: Array<{ message?: { content?: unknown } }>; usage?: unknown }
    const content = json.choices?.[0]?.message?.content
    if (typeof content !== 'string' || content.length === 0) {
      throw visionError('PROTOCOL', 'Vision API returned no text content.')
    }
    const result: { content: string; usage?: VisionUsage } = { content }
    const usage = json.usage as { prompt_tokens?: unknown; completion_tokens?: unknown; total_tokens?: unknown } | undefined
    if (usage !== undefined) {
      result.usage = {
        promptTokens: numberOr(usage.prompt_tokens, 0),
        completionTokens: numberOr(usage.completion_tokens, 0),
        totalTokens: numberOr(usage.total_tokens, 0),
      }
    }
    return result
  } catch (error) {
    if (error instanceof VisionError) throw error
    if (controller.signal.aborted) throw visionError('TIMEOUT', 'Vision API request timed out.')
    throw visionError('NETWORK', `Vision API request failed: ${errorMessage(error)}`)
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', onOuterAbort)
  }
}

/**
 * Ping a chat-completions endpoint with a minimal text prompt.
 * @param baseUrl - endpoint base; `/chat/completions` is appended when absent.
 * @param apiKey - bearer credential.
 * @param model - model name to test.
 * @param signal - optional abort signal.
 */
export async function testConnection(
  baseUrl: string,
  apiKey: string,
  model: string,
  signal?: AbortSignal,
): Promise<VisionTestResult> {
  const started = Date.now()
  try {
    const result = await callChatCompletions(
      completionsUrl(baseUrl),
      apiKey,
      model,
      [{ role: 'user', content: 'ping' }],
      signal,
    )
    return { ok: true, latencyMs: Date.now() - started, echo: result.content.trim() }
  } catch (error) {
    return { ok: false, latencyMs: Date.now() - started, error: normalize(error) }
  }
}

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
export async function describeImage(
  baseUrl: string,
  apiKey: string,
  model: string,
  data: string,
  mediaType: string,
  prompt?: string,
  signal?: AbortSignal,
): Promise<VisionDescribeResult> {
  const messages = [
    {
      role: 'user',
      content: [
        { type: 'text', text: prompt ?? 'Describe this image in detail, including any visible text.' },
        { type: 'image_url', image_url: { url: imageDataUrl(data, mediaType) } },
      ],
    },
  ]
  const result = await callChatCompletions(completionsUrl(baseUrl), apiKey, model, messages, signal)
  const describe: VisionDescribeResult = { description: result.content }
  if (result.usage !== undefined) describe.usage = result.usage
  return describe
}

/** Describe an ordered set of images in one OpenAI-compatible multimodal request. */
export async function describeImages(
  baseUrl: string,
  apiKey: string,
  model: string,
  images: readonly { data: string; mediaType: string }[],
  prompt: string,
  signal?: AbortSignal,
): Promise<VisionDescribeResult> {
  if (images.length === 0) throw new Error('at least one image is required')
  const content = [
    { type: 'text', text: prompt },
    ...images.map(image => ({
      type: 'image_url',
      image_url: { url: imageDataUrl(image.data, image.mediaType) },
    })),
  ]
  const result = await callChatCompletions(
    completionsUrl(baseUrl),
    apiKey,
    model,
    [{ role: 'user', content }],
    signal,
  )
  return {
    description: result.content,
    ...(result.usage === undefined ? {} : { usage: result.usage }),
  }
}

/** Derive a provider balance probe from the endpoint base, or undefined. */
function balanceProbe(baseUrl: string): { url: string; parse: (json: unknown) => VisionBalanceLine[] } | undefined {
  const base = baseUrl.replace(/\/+$/, '')
  if (baseUrl.includes('deepseek.com')) {
    return {
      url: `${base}/user/balance`,
      parse: (json) => {
        const body = json as { balance_infos?: unknown }
        const infos = body.balance_infos
        if (!Array.isArray(infos)) return []
        return infos.map((info) => {
          const row = info as { currency?: unknown; total_balance?: unknown; granted_balance?: unknown; topped_up_balance?: unknown }
          return {
            currency: String(row.currency ?? ''),
            total: numberOr(row.total_balance, 0),
            available: numberOr(row.granted_balance, 0),
            used: numberOr(row.topped_up_balance, 0),
          }
        })
      },
    }
  }
  if (baseUrl.includes('siliconflow.cn')) {
    return {
      url: `${base}/v1/user/info`,
      parse: (json) => {
        const body = json as { data?: unknown }
        const data = body.data
        if (typeof data !== 'object' || data === null) return []
        const row = data as { totalBalance?: unknown; balance?: unknown; chargeBalance?: unknown }
        const total = numberOr(row.totalBalance, 0)
        return [{
          currency: 'CNY',
          total,
          available: numberOr(row.balance, 0),
          used: numberOr(row.chargeBalance, 0),
        }]
      },
    }
  }
  if (baseUrl.includes('moonshot') || baseUrl.includes('kimi')) {
    return {
      url: `${base}/v1/users/me/balance`,
      parse: (json) => {
        const body = json as { data?: unknown }
        const data = body.data
        if (typeof data !== 'object' || data === null) return []
        const row = data as { cash_balance?: unknown; available_balance?: unknown; voucher_balance?: unknown }
        return [{
          currency: 'CNY',
          total: numberOr(row.cash_balance, 0),
          available: numberOr(row.available_balance, 0),
          used: numberOr(row.voucher_balance, 0),
        }]
      },
    }
  }
  return undefined
}

/**
 * Query a provider's remaining balance when it exposes a known endpoint.
 * Recognized: DeepSeek `/user/balance`, SiliconFlow `/v1/user/info`,
 * Moonshot `/v1/users/me/balance`. Unknown endpoints report unsupported.
 * @param baseUrl - endpoint base used to derive the balance path.
 * @param apiKey - bearer credential.
 * @param signal - optional abort signal.
 */
export async function queryBalance(baseUrl: string, apiKey: string, signal?: AbortSignal): Promise<VisionBalanceResult> {
  const probe = balanceProbe(baseUrl)
  if (probe === undefined) {
    return { supported: false }
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DEFAULT_VISION_TIMEOUT_MS)
  const onOuterAbort = () => controller.abort()
  signal?.addEventListener('abort', onOuterAbort, { once: true })
  try {
    const response = await fetch(probe.url, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      redirect: 'manual',
      signal: controller.signal,
    })
    if (response.status >= 300) throw await httpError(response)
    const json = await response.json()
    return { supported: true, lines: probe.parse(json) }
  } catch (error) {
    return { supported: true, error: normalize(error) }
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', onOuterAbort)
  }
}
