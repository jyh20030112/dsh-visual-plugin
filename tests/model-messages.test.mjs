import assert from 'node:assert/strict'
import test from 'node:test'

import { ModelImageBridge } from '../src/model-messages.ts'

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
  assert.deepEqual(descriptions, [{
    attachmentId: 'sha256:castle',
    description: '一幅城堡与山谷的风景画。',
  }])
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

test('does not cache failed descriptions', async () => {
  let calls = 0
  const bridge = new ModelImageBridge({
    describe: async () => {
      calls += 1
      if (calls === 1) throw new Error('temporary failure')
      return 'recovered description'
    },
    onDescription: () => {},
    failureText: error => `[视觉描述失败] ${error instanceof Error ? error.message : String(error)}`,
  })
  const message = { role: 'user', content: [{ type: 'image', attachment }] }

  const failed = await bridge.rewrite([message])
  const recovered = await bridge.rewrite([message])

  assert.match(failed[0].content[0].text, /temporary failure/)
  assert.match(recovered[0].content[0].text, /recovered description/)
  assert.equal(calls, 2)
})
