import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { ModelImageBridge } from '../src/model-messages.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const serializePath = [
  process.env.HARNESS,
  resolve(root, '../deepseek-harness'),
  resolve(root, '../../deepseek-harness'),
].filter(Boolean).map(harness => resolve(harness, 'packages/llm/llm-deepseek/src/serialize.ts'))
  .find(existsSync)

if (serializePath === undefined) {
  throw new Error('set HARNESS to a local deepseek-harness checkout')
}

const { serializeMessages } = await import(pathToFileURL(serializePath).href)

const attachment = {
  attachmentId: 'sha256:castle',
  mediaType: 'image/png',
  width: 1180,
  height: 992,
  bytes: 1930570,
  name: 'image.png',
}

test('rewrites images only in model-bound copies and preserves the visible user message', async () => {
  const calls = []
  const descriptions = []
  const bridge = new ModelImageBridge({
    describe: async (request) => {
      calls.push(request)
      return '一幅城堡与山谷的风景画。'
    },
    onDescription: entry => descriptions.push(entry),
    failureText: error => `[视觉描述失败] ${String(error)}`,
  })
  const message = {
    role: 'user',
    id: 'message-1',
    source: { kind: 'user' },
    content: [
      { type: 'image', attachment },
      { type: 'text', text: '这是什么？' },
    ],
  }
  const original = structuredClone(message)

  const rewritten = await bridge.rewrite([message])

  assert.deepEqual(message, original)
  assert.notStrictEqual(rewritten[0], message)
  assert.deepEqual(rewritten[0].content, [
    {
      type: 'text',
      text: '[视觉描述] 一幅城堡与山谷的风景画。\n[附件] sha256:castle\n',
    },
    { type: 'text', text: '这是什么？' },
  ])
  assert.equal(calls.length, 1)
  assert.equal(calls[0].userText, '这是什么？')
  assert.equal(descriptions.length, 1)
  assert.match(descriptions[0].operationId, /.+/)
  assert.equal(descriptions[0].attachmentId, 'sha256:castle')
  assert.equal(descriptions[0].description, '一幅城堡与山谷的风景画。')
})

test('caches one automatic description per attachment across model steps', async () => {
  let calls = 0
  const bridge = new ModelImageBridge({
    describe: async () => {
      calls += 1
      return 'cached description'
    },
    onDescription: () => {},
    failureText: error => `[视觉描述失败] ${String(error)}`,
  })
  const message = {
    role: 'user',
    content: [{ type: 'image', attachment }, { type: 'text', text: 'identify it' }],
  }

  await bridge.rewrite([message])
  await bridge.rewrite([message])

  assert.equal(calls, 1)
  assert.equal(bridge.cachedDescription('sha256:castle'), 'cached description')
})

test('publishes one visual lifecycle for an automatic description across model steps', async () => {
  const lifecycle = []
  let describeCalls = 0
  const bridge = new ModelImageBridge({
    describe: async () => {
      describeCalls += 1
      return '一只白色鲸鱼图标。'
    },
    failureText: () => '视觉解析失败。',
    onStart: event => lifecycle.push({ type: 'start', ...event }),
    onDescription: event => lifecycle.push({ type: 'success', ...event }),
    onFailure: event => lifecycle.push({ type: 'failure', ...event }),
  })
  const messages = [{
    id: 'message-lifecycle',
    role: 'user',
    content: [{ type: 'image', attachment }, { type: 'text', text: '这是什么？' }],
  }]

  await bridge.rewrite(messages, { sessionId: 'session-1' })
  await bridge.rewrite(messages, { sessionId: 'session-1' })

  assert.equal(describeCalls, 1)
  assert.deepEqual(lifecycle.map(event => event.type), ['start', 'success'])
  assert.equal(lifecycle[0].operationId, lifecycle[1].operationId)
  assert.equal(lifecycle[0].attachmentId, attachment.attachmentId)
  assert.equal(lifecycle[1].description, '一只白色鲸鱼图标。')
  assert.equal(lifecycle[1].sessionId, 'session-1')
  assert.equal(lifecycle[1].messageId, 'message-lifecycle')
})

test('does not cache failed descriptions', async () => {
  let calls = 0
  const lifecycle = []
  const bridge = new ModelImageBridge({
    describe: async () => {
      calls += 1
      if (calls === 1) throw new Error('temporary failure')
      return 'recovered description'
    },
    onStart: event => lifecycle.push({ type: 'start', ...event }),
    onDescription: () => {},
    onFailure: event => lifecycle.push({ type: 'failure', ...event }),
    failureText: error => `[视觉描述失败] ${error instanceof Error ? error.message : String(error)}`,
  })
  const message = { role: 'user', content: [{ type: 'image', attachment }] }

  const failed = await bridge.rewrite([message])
  const recovered = await bridge.rewrite([message])

  assert.match(failed[0].content[0].text, /temporary failure/)
  assert.match(recovered[0].content[0].text, /recovered description/)
  assert.equal(calls, 2)
  assert.deepEqual(lifecycle.map(event => event.type), ['start', 'failure', 'start'])
  assert.equal(lifecycle[0].operationId, lifecycle[1].operationId)
  assert.equal(lifecycle[1].error, '[视觉描述失败] temporary failure')
})

test('rewrites read_image output nested inside a tool result before DeepSeek serialization', async () => {
  const generatedAttachment = {
    ...attachment,
    attachmentId: 'sha256:generated-palette',
    name: 'pastoral-wallpaper-palette.png',
  }
  const bridge = new ModelImageBridge({
    describe: async () => '一张包含七个田园配色样本的横向色板。',
    onDescription: () => {},
    failureText: error => error instanceof Error ? error.message : String(error),
  })
  const message = {
    role: 'user',
    source: { kind: 'tool', callId: 'call-read-image' },
    content: [{
      type: 'tool-result',
      toolCallId: 'call-read-image',
      content: [
        { type: 'text', text: '<path>pastoral-wallpaper-palette.png</path>' },
        { type: 'image', attachment: generatedAttachment },
      ],
      isError: false,
    }],
  }
  const original = structuredClone(message)

  assert.throws(
    () => serializeMessages([message]),
    /The DeepSeek chat-completions adapter does not support image content/,
  )

  const rewritten = await bridge.rewrite([message])

  assert.deepEqual(message, original)
  assert.doesNotThrow(() => serializeMessages(rewritten))
  assert.deepEqual(rewritten[0].content[0].content, [
    { type: 'text', text: '<path>pastoral-wallpaper-palette.png</path>' },
    {
      type: 'text',
      text: '[视觉描述] 一张包含七个田园配色样本的横向色板。\n[附件] sha256:generated-palette\n',
    },
  ])
})
