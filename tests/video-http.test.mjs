import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { createVideoCoordinator } from '../src/video/index.ts'
import { registerVideoRoutes } from '../src/video/http.ts'

function readyMediaEngine() {
  return {
    async health() {
      return {
        available: true,
        features: { libx264: true, nvenc: false, hdrToneMap: true, deinterlace: true },
        issues: [],
      }
    },
    async prepare(request) {
      await mkdir(request.outputDir, { recursive: true })
      await writeFile(join(request.outputDir, 'normalized.mp4'), Buffer.from('normalized-video'))
      await writeFile(join(request.outputDir, 'poster.jpg'), Buffer.from('poster'))
      return {
        normalizedFile: 'normalized.mp4',
        posterFile: 'poster.jpg',
        durationSeconds: 2,
        width: 320,
        height: 240,
        frames: [{ frameId: 'F01', timestampSeconds: 0, file: 'frame.jpg' }],
        warnings: ['audio_not_analyzed'],
        sceneEngine: 'pyscenedetect',
      }
    },
    async extractRange() { return [] },
  }
}

test('same-origin video routes stream upload metadata and range playback', async (t) => {
  const rootDir = await mkdtemp(join(tmpdir(), 'dsh-video-http-'))
  t.after(() => rm(rootDir, { recursive: true, force: true }))
  const coordinator = await createVideoCoordinator({
    rootDir,
    mediaEngine: readyMediaEngine(),
    createId: () => 'video-http000000001',
  })
  let route
  registerVideoRoutes({ register(value) { route = value; return () => {} } }, coordinator, {
    sessionExists: sessionId => sessionId === 'session-a',
  })
  const server = createServer((req, res) => route.handler(req, res))
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
  } catch (error) {
    if (error.code === 'EPERM') {
      t.skip('sandbox does not permit loopback listeners')
      return
    }
    throw error
  }
  t.after(() => new Promise(resolve => server.close(resolve)))
  const address = server.address()
  const base = `http://127.0.0.1:${address.port}`

  const createdResponse = await fetch(`${base}/vision-bridge/videos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base },
    body: JSON.stringify({
      sessionId: 'session-a',
      fileName: 'clip.mp4',
      mediaType: 'video/mp4',
      declaredSize: 4,
    }),
  })
  assert.equal(createdResponse.status, 201)
  const created = await createdResponse.json()

  const uploadedResponse = await fetch(
    `${base}/vision-bridge/videos/${created.video.videoId}/upload?sessionId=session-a`,
    { method: 'PUT', headers: { 'Content-Length': '4', Origin: base }, body: Buffer.from('same') },
  )
  assert.equal(uploadedResponse.status, 200)
  assert.equal((await uploadedResponse.json()).video.status, 'ready')

  const list = await fetch(`${base}/vision-bridge/videos?sessionId=session-a`).then(response => response.json())
  assert.equal(list.videos.length, 1)

  const content = await fetch(`${base}/vision-bridge/videos/${created.video.videoId}/content`, {
    headers: { Range: 'bytes=0-5' },
  })
  assert.equal(content.status, 206)
  assert.equal(content.headers.get('content-range'), 'bytes 0-5/16')
  assert.equal(content.headers.get('accept-ranges'), 'bytes')
  assert.equal(content.headers.get('x-content-type-options'), 'nosniff')
  assert.equal(await content.text(), 'normal')

  const deleted = await fetch(
    `${base}/vision-bridge/videos/${created.video.videoId}?sessionId=session-a`,
    { method: 'DELETE', headers: { Origin: base } },
  )
  assert.equal(deleted.status, 204)
})
