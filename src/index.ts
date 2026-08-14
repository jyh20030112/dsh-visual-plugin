/**
 * Vision bridge plugin, host half: describe user images through a
 * user-configured OpenAI-compatible vision model when the main model has no
 * vision. Intercepts `agent/pre-step` to replace image blocks with text
 * descriptions before serialization (the main route rejects image content),
 * registers the `vision_describe` tool for follow-up asks, serves the
 * connection-test and balance routes the web panel calls, and registers the
 * `deepseek-vision` wrapper adapter so the gateway admits image uploads.
 * @module dsh-visual-plugin
 */

import type { Context } from '@deepseek-ai/cordis'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type {} from '@deepseek-ai/cordis'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ImageBlock, UserMessage } from '@deepseek-ai/dsh-llm'
import type { PreStepDecision } from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/dsh-credentials'
import type {} from '@deepseek-ai/dsh-attachment'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-system-prompt'
import { DEFAULT_API_KEY_ENV, NS, VisionBridgeConfig, type VisionBridgeConfigValue } from './config.ts'
import { describeImage, queryBalance, testConnection } from './vision.ts'
import { registerVisionAdapter } from './adapter.ts'

/** Vision-bridge plugin name. */
export const name = 'vision-bridge'

/**
 * Required services: the core seams the bridge cannot function without —
 * the tool registry, the settings/credentials seams for the vision endpoint
 * facts, the attachment store for image bytes, and the llm registry for the
 * wrapper adapter. All ship in the base bundle, so any tree that mounts this
 * plugin provides them; webServer stays optional because it exists only in
 * web-surface trees.
 */
export const inject = ['tools', 'settings', 'credentials', 'attachments', 'llm']

/** One recent bridge activity row for the web panel's history feed. */
interface RecentEntry {
  time: number
  attachmentId: string
  description: string
}

/**
 * The host half: pre-step image interception, the describe tool, the panel's
 * HTTP routes, and the wrapper adapter.
 * @param ctx - plugin context.
 */
export function apply(ctx: Context): void {
  // attachmentId -> full reference, learned from the intercepted user images.
  // The main model never sees image blocks (its route rejects them), so it
  // can only pass the id from a rewritten [视觉描述] block; the bridge resolves
  // the full ref it needs for readImage verification here.
  const refs = new Map<string, ImageAttachmentRef>()

  // Recent bridge activity, newest first, for the web panel's history feed.
  // The panel polls this through /vision-bridge/recent instead of scanning
  // session logs; the entries are presentation-only and never model-visible.
  const recent: RecentEntry[] = []
  const MAX_RECENT = 20

  const settings = ctx.get('settings')!
  const credentials = ctx.get('credentials')!
  const attachments = ctx.get('attachments')!
  const webServer = ctx.get('webServer')

  const scope = settings.register(NS, VisionBridgeConfig, {
    base: { url: '', model: '', apiKeyEnv: DEFAULT_API_KEY_ENV },
  })

  /** Resolve the configured endpoint facts, or undefined when unconfigured. */
  async function resolvedFacts(): Promise<{ url: string; model: string; apiKey: string } | undefined> {
    const value = scope.get()
    const url = value?.url ?? ''
    const model = value?.model ?? ''
    if (url.length === 0 || model.length === 0) return undefined
    const apiKeyEnv = value?.apiKeyEnv ?? DEFAULT_API_KEY_ENV
    const resolved = await credentials.resolve(credentialRef(apiKeyEnv))
    if (resolved === undefined) return undefined
    return { url, model, apiKey: resolved.value }
  }

  /** Encode image bytes as a base64 string for the data URL payload. */
  function toBase64(data: Uint8Array): string {
    return Buffer.from(data).toString('base64')
  }

  /** Replace every image block in one message with its description text. */
  async function describeImagesInMessage(
    message: UserMessage,
    facts: { url: string; model: string; apiKey: string },
    signal: AbortSignal,
  ): Promise<{ text: string; attachmentId: string } | undefined> {
    const imageBlock = message.content.find((block): block is ImageBlock => block.type === 'image')
    if (imageBlock === undefined) return undefined
    const ref = imageBlock.attachment
    refs.set(String(ref.attachmentId), ref)
    const stored = await attachments.readImage(ref, signal)
    const result = await describeImage(
      facts.url,
      facts.apiKey,
      facts.model,
      toBase64(stored.data),
      ref.mediaType,
      undefined,
      signal,
    )
    return { text: result.description, attachmentId: String(ref.attachmentId) }
  }

  /** Replace every image block with a failure text so the main model can answer instead of failing. */
  function replaceWithFailure(messages: UserMessage[], reason: string): PreStepDecision {
    const rewritten = messages.map((message) => ({
      ...message,
      content: message.content.map((block) => block.type === 'image'
        ? { type: 'text' as const, text: `[视觉描述失败] ${reason}` }
        : block),
    }))
    return { kind: 'enter', messages: rewritten }
  }

  ctx.on('agent/pre-step', async ({ messages, signal }, next) => {
    const hasImage = messages.some(message => message.content.some(block => block.type === 'image'))
    if (!hasImage) return next()
    const facts = await resolvedFacts()
    if (facts === undefined) {
      return replaceWithFailure(messages, 'vision model is not configured (set it in the right-side panel)')
    }
    const rewritten: UserMessage[] = []
    for (const message of messages) {
      const described = await describeImagesInMessage(message, facts, signal)
      if (described === undefined) {
        rewritten.push(message)
        continue
      }
      rewritten.push({
        ...message,
        content: message.content.map((block) => block.type === 'image'
          ? { type: 'text' as const, text: `[视觉描述] ${described.text}\n[附件] ${described.attachmentId}` }
          : block),
      })
      recent.unshift({ time: Date.now(), attachmentId: described.attachmentId, description: described.text })
      if (recent.length > MAX_RECENT) recent.length = MAX_RECENT
    }
    return { kind: 'enter', messages: rewritten }
  })

  ctx.tools.register(defineTool({
    name: 'vision_describe',
    description: 'Send one previously attached user image to the configured vision model and return its description. '
      + 'Pass the attachmentId shown in the [视觉描述] block of the user message. The main model has no vision, '
      + 'so this tool is how you answer follow-up questions about a specific image.',
    parameters: {
      attachmentId: { type: 'string', required: true, description: 'The image attachment id from the [视觉描述] block.' },
      prompt: { type: 'string', description: 'Optional specific question about the image; defaults to a general description.' },
    },
    output: {
      schema: {
        type: 'object',
        properties: { description: { type: 'string' } },
        additionalProperties: false,
      },
      render: (_args, value) => {
        const description = (value as { description?: unknown }).description
        return [{ type: 'text', text: typeof description === 'string' ? description : JSON.stringify(value) }]
      },
    },
    timeoutMs: 60_000,
    async execute(args, exec) {
      const ref = refs.get(String(args.attachmentId))
      if (ref === undefined) throw new Error(`vision_describe: unknown attachment ${args.attachmentId}`)
      const facts = await resolvedFacts()
      if (facts === undefined) throw new Error('vision_describe: vision model is not configured')
      const stored = await attachments.readImage(ref, exec.signal)
      const result = await describeImage(
        facts.url,
        facts.apiKey,
        facts.model,
        toBase64(stored.data),
        ref.mediaType,
        args.prompt,
        exec.signal,
      )
      recent.unshift({ time: Date.now(), attachmentId: String(ref.attachmentId), description: result.description })
      if (recent.length > MAX_RECENT) recent.length = MAX_RECENT
      return { description: result.description }
    },
  }))

  // Tell the model how to follow up when it sees a placeholder or a description block.
  const systemPrompt = ctx.get('systemPrompt')
  if (systemPrompt !== undefined) {
    systemPrompt.section({
      name: 'vision-bridge',
      order: 115,
      text: 'The user may attach images. Each attached image is described before it reaches you: '
        + 'you see "[视觉描述] <description>\\n[附件] <attachmentId>" (or "<image attachmentId=\\"…\\">" as a fallback). '
        + 'To answer a follow-up question about a specific image, call the vision_describe tool with that attachmentId.',
    })
  }

  // FR0: admit image uploads by exposing the deepseek-vision provider route.
  // The llm registry is a hard inject, so the adapter is always registered.
  registerVisionAdapter(ctx)

  // The panel's HTTP routes. webServer may appear after our apply (it is a
  // web-surface service, absent from headless/base trees), so register through
  // the loader's inject when it is not there yet; a tree that never mounts
  // webServer simply never serves these routes. Every registration is an
  // effect so reload/teardown removes the route.
  const writeJson = (res: ServerResponse, body: unknown, status = 200): void => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify(body))
  }
  const readJsonBody = async (req: IncomingMessage): Promise<Record<string, unknown>> => {
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(chunk as Buffer)
    const text = Buffer.concat(chunks).toString('utf8')
    try {
      return JSON.parse(text) as Record<string, unknown>
    } catch {
      return {}
    }
  }
  const stringField = (body: Record<string, unknown>, key: string): string =>
    typeof body[key] === 'string' ? body[key] as string : ''

  const registerPanelRoutes = (ws: typeof webServer extends undefined ? never : NonNullable<typeof webServer>): void => {
    ctx.effect(() => ws.register({
      kind: 'exact',
      path: '/vision-bridge/test',
      async handler(req, res) {
        const body = await readJsonBody(req)
        const url = stringField(body, 'url')
        const model = stringField(body, 'model')
        const apiKey = stringField(body, 'apiKey')
        if (url.length === 0 || model.length === 0) {
          writeJson(res, { ok: false, error: { code: 'CONFIG', message: 'url and model are required' } })
          return
        }
        const key = apiKey.length > 0 ? apiKey : (await resolvedFacts())?.apiKey
        if (key === undefined) {
          writeJson(res, { ok: false, error: { code: 'AUTH', message: 'api_key is required' } })
          return
        }
        const result = await testConnection(url, key, model)
        writeJson(res, result)
      },
    }), 'vision-bridge: route /vision-bridge/test')

    ctx.effect(() => ws.register({
      kind: 'exact',
      path: '/vision-bridge/balance',
      async handler(_req, res) {
        const facts = await resolvedFacts()
        if (facts === undefined) {
          writeJson(res, { supported: false, error: { code: 'CONFIG', message: 'vision model is not configured' } })
          return
        }
        const result = await queryBalance(facts.url, facts.apiKey)
        writeJson(res, result)
      },
    }), 'vision-bridge: route /vision-bridge/balance')

    ctx.effect(() => ws.register({
      kind: 'exact',
      path: '/vision-bridge/recent',
      async handler(_req, res) {
        writeJson(res, { entries: recent })
      },
    }), 'vision-bridge: route /vision-bridge/recent')
  }

  if (webServer !== undefined) {
    registerPanelRoutes(webServer)
  } else {
    ctx.inject(['webServer'], (scoped) => {
      registerPanelRoutes(scoped.webServer)
    })
  }
}
