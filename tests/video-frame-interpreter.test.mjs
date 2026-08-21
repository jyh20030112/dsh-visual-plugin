import assert from 'node:assert/strict'
import test from 'node:test'

import { createVisionFrameInterpreter } from '../src/video/frame-interpreter.ts'

function response(content, status = 200) {
  return new Response(JSON.stringify({
    choices: [{ message: { content } }],
  }), { status, headers: { 'Content-Type': 'application/json' } })
}

test('frame interpreter sends timestamped frames in one multimodal batch', async (t) => {
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  let requestBody
  globalThis.fetch = async (_url, init) => {
    requestBody = JSON.parse(init.body)
    return response('ordered scene evidence')
  }
  const interpreter = createVisionFrameInterpreter(async () => ({
    url: 'https://vision.example/v1',
    apiKey: 'secret',
    model: 'vision-model',
  }))

  const description = await interpreter.describe({
    prompt: 'What happens?',
    frames: [
      { frameId: 'F01', timestampSeconds: 0, mediaType: 'image/jpeg', data: Buffer.from('one') },
      { frameId: 'F02', timestampSeconds: 2.5, mediaType: 'image/jpeg', data: Buffer.from('two') },
    ],
  })

  assert.equal(description, 'ordered scene evidence')
  const content = requestBody.messages[0].content
  assert.match(content[0].text, /F01.*0\.000s.*F02.*2\.500s/s)
  assert.equal(content.filter(item => item.type === 'image_url').length, 2)
  assert.equal(content[1].image_url.url, `data:image/jpeg;base64,${Buffer.from('one').toString('base64')}`)
})

test('frame interpreter falls back to one image per request when batching is rejected', async (t) => {
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  let calls = 0
  globalThis.fetch = async () => {
    calls += 1
    if (calls === 1) return response('batch rejected', 400)
    return response(calls === 2 ? 'first frame' : 'second frame')
  }
  const interpreter = createVisionFrameInterpreter(async () => ({
    url: 'https://vision.example/v1', apiKey: 'secret', model: 'vision-model',
  }))

  const description = await interpreter.describe({
    prompt: 'Summarize',
    frames: [
      { frameId: 'F01', timestampSeconds: 1, mediaType: 'image/jpeg', data: Buffer.from('one') },
      { frameId: 'F02', timestampSeconds: 3, mediaType: 'image/jpeg', data: Buffer.from('two') },
    ],
  })

  assert.equal(calls, 3)
  assert.match(description, /\[F01 @ 1\.000s\] first frame/)
  assert.match(description, /\[F02 @ 3\.000s\] second frame/)
})
