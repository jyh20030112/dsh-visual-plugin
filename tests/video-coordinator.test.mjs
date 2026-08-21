import assert from 'node:assert/strict'
import { access, mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { createVideoCoordinator } from '../src/video/index.ts'

function body(...chunks) {
  return (async function* () {
    for (const chunk of chunks) yield Buffer.from(chunk)
  })()
}

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
        durationSeconds: 12.5,
        width: 1280,
        height: 720,
        frames: [
          { frameId: 'F01', timestampSeconds: 0, file: 'frame-F01.jpg', highResolutionFile: 'frame-F01-hq.jpg' },
        ],
        warnings: ['audio_not_analyzed'],
        sceneEngine: 'pyscenedetect',
      }
    },
    async extractRange() {
      return []
    },
  }
}

test('a streamed upload becomes ready and survives coordinator restart', async (t) => {
  const rootDir = await mkdtemp(join(tmpdir(), 'dsh-video-'))
  t.after(async () => {
    await import('node:fs/promises').then(fs => fs.rm(rootDir, { recursive: true, force: true }))
  })

  const options = {
    rootDir,
    mediaEngine: readyMediaEngine(),
    now: () => 1_700_000_000_000,
    createId: () => 'video-0123456789abcdef',
  }
  const coordinator = await createVideoCoordinator(options)
  const ready = await coordinator.upload({
    sessionId: 'session-a',
    fileName: 'demo.mp4',
    mediaType: 'video/mp4',
    declaredSize: 6,
    body: body('abc', 'def'),
  })

  assert.deepEqual(ready, {
    videoId: 'video-0123456789abcdef',
    sessionId: 'session-a',
    fileName: 'demo.mp4',
    mediaType: 'video/mp4',
    sizeBytes: 6,
    sha256: 'bef57ec7f53a6d40beb640a780a639c83bc29ac8a9816f1fc6c5c6dcd93c4721',
    status: 'ready',
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    durationSeconds: 12.5,
    width: 1280,
    height: 720,
    normalizedUrl: '/vision-bridge/videos/video-0123456789abcdef/content',
    posterUrl: '/vision-bridge/videos/video-0123456789abcdef/poster',
    frameCount: 1,
    warnings: ['audio_not_analyzed'],
    sceneEngine: 'pyscenedetect',
  })

  const restored = await createVideoCoordinator({ ...options, mediaEngine: readyMediaEngine() })
  assert.deepEqual(await restored.list('session-a'), [ready])
  assert.deepEqual(await restored.list('session-b'), [])
})

test('an upload that exceeds its configured limit is rejected before media processing', async (t) => {
  const rootDir = await mkdtemp(join(tmpdir(), 'dsh-video-'))
  t.after(async () => {
    await import('node:fs/promises').then(fs => fs.rm(rootDir, { recursive: true, force: true }))
  })
  const coordinator = await createVideoCoordinator({
    rootDir,
    mediaEngine: readyMediaEngine(),
    limits: { maxUploadBytes: 5 },
  })

  await assert.rejects(
    coordinator.upload({
      sessionId: 'session-a',
      fileName: 'too-large.mp4',
      mediaType: 'video/mp4',
      declaredSize: 6,
      body: body('abcdef'),
    }),
    error => error.code === 'upload_too_large',
  )
  assert.deepEqual(await coordinator.list('session-a'), [])
})

test('the same bytes reuse one prepared video only inside their owning session', async (t) => {
  const rootDir = await mkdtemp(join(tmpdir(), 'dsh-video-'))
  t.after(async () => {
    await import('node:fs/promises').then(fs => fs.rm(rootDir, { recursive: true, force: true }))
  })
  let nextId = 0
  const coordinator = await createVideoCoordinator({
    rootDir,
    mediaEngine: readyMediaEngine(),
    createId: () => `video-dedup0000000${++nextId}`,
  })
  const upload = sessionId => coordinator.upload({
    sessionId,
    fileName: 'same.mp4',
    mediaType: 'video/mp4',
    declaredSize: 4,
    body: body('same'),
  })

  const first = await upload('session-a')
  const duplicate = await upload('session-a')
  const otherSession = await upload('session-b')

  assert.equal(duplicate.videoId, first.videoId)
  assert.notEqual(otherSession.videoId, first.videoId)
  assert.equal((await coordinator.list('session-a')).length, 1)
  assert.equal((await coordinator.list('session-b')).length, 1)
})

test('two-step uploads and deletion remain scoped to the owning session', async (t) => {
  const rootDir = await mkdtemp(join(tmpdir(), 'dsh-video-'))
  t.after(async () => {
    await import('node:fs/promises').then(fs => fs.rm(rootDir, { recursive: true, force: true }))
  })
  const coordinator = await createVideoCoordinator({
    rootDir,
    mediaEngine: readyMediaEngine(),
    createId: () => 'video-owned00000001',
  })

  const staged = await coordinator.createUpload({
    sessionId: 'session-owner',
    fileName: 'owned.mp4',
    mediaType: 'video/mp4',
    declaredSize: 4,
  })
  assert.equal(staged.status, 'uploading')

  await assert.rejects(
    coordinator.delete('session-owner', staged.videoId),
    error => error.code === 'invalid_video_state',
  )

  await assert.rejects(
    coordinator.writeUpload({ videoId: staged.videoId, sessionId: 'session-other', body: body('same') }),
    error => error.code === 'video_not_found',
  )
  const ready = await coordinator.writeUpload({
    videoId: staged.videoId,
    sessionId: 'session-owner',
    body: body('same'),
  })
  assert.equal(ready.status, 'ready')

  await assert.rejects(
    coordinator.delete('session-other', staged.videoId),
    error => error.code === 'video_not_found',
  )
  await coordinator.delete('session-owner', staged.videoId)
  assert.deepEqual(await coordinator.list('session-owner'), [])
})

test('analysis batches extracted frames, keeps ownership, and deletes sent high-resolution copies', async (t) => {
  const rootDir = await mkdtemp(join(tmpdir(), 'dsh-video-'))
  t.after(async () => {
    await import('node:fs/promises').then(fs => fs.rm(rootDir, { recursive: true, force: true }))
  })
  const calls = []
  const mediaEngine = {
    ...readyMediaEngine(),
    async prepare(request) {
      await writeFile(join(request.outputDir, 'normalized.mp4'), Buffer.from('normalized-video'))
      await writeFile(join(request.outputDir, 'poster.jpg'), Buffer.from('poster'))
      const frames = []
      for (let index = 0; index < 7; index += 1) {
        const frameId = `F0${index + 1}`
        const file = `frame-${frameId}.jpg`
        const highResolutionFile = `frame-${frameId}-hq.jpg`
        await writeFile(join(request.outputDir, file), Buffer.from(`normal-${index}`))
        await writeFile(join(request.outputDir, highResolutionFile), Buffer.from(`high-${index}`))
        frames.push({ frameId, timestampSeconds: index * 2, file, highResolutionFile })
      }
      return {
        normalizedFile: 'normalized.mp4',
        posterFile: 'poster.jpg',
        durationSeconds: 14,
        width: 1280,
        height: 720,
        frames,
        warnings: [],
        sceneEngine: 'pyscenedetect',
      }
    },
  }
  const coordinator = await createVideoCoordinator({
    rootDir,
    mediaEngine,
    createId: () => 'video-analysis000001',
    frameInterpreter: {
      async describe(request) {
        calls.push(request)
        return `evidence:${request.frames.map(frame => frame.timestampSeconds).join(',')}`
      },
    },
  })
  const ready = await coordinator.upload({
    sessionId: 'session-owner',
    fileName: 'analyze.mp4',
    mediaType: 'video/mp4',
    declaredSize: 4,
    body: body('same'),
  })

  await assert.rejects(
    coordinator.analyze({ sessionId: 'session-other', videoId: ready.videoId, prompt: 'What happens?' }),
    error => error.code === 'video_not_found',
  )
  const result = await coordinator.analyze({
    sessionId: 'session-owner',
    videoId: ready.videoId,
    prompt: 'What happens?',
  })

  assert.deepEqual(calls.map(call => call.frames.length), [6, 1])
  assert.equal(calls[0].prompt, 'What happens?')
  assert.equal(calls[0].frames[0].data.toString(), 'high-0')
  assert.deepEqual(result.evidence.map(item => item.description), [
    'evidence:0,2,4,6,8,10',
    'evidence:12',
  ])
  assert.equal((await coordinator.list('session-owner'))[0].status, 'done')

  const jobDir = join(rootDir, 'jobs', ready.videoId)
  await assert.rejects(access(join(jobDir, 'frame-F01-hq.jpg')), error => error.code === 'ENOENT')
  await access(join(jobDir, 'frame-F01.jpg'))
})

test('restart fails interrupted work and removes terminal videos after seven days', async (t) => {
  const rootDir = await mkdtemp(join(tmpdir(), 'dsh-video-'))
  t.after(async () => {
    await import('node:fs/promises').then(fs => fs.rm(rootDir, { recursive: true, force: true }))
  })
  let nextId = 0
  const startedAt = 1_700_000_000_000
  const first = await createVideoCoordinator({
    rootDir,
    mediaEngine: readyMediaEngine(),
    now: () => startedAt,
    createId: () => `video-recovery00000${++nextId}`,
  })
  await first.upload({
    sessionId: 'session-a', fileName: 'old.mp4', mediaType: 'video/mp4', declaredSize: 3, body: body('old'),
  })
  const interrupted = await first.createUpload({
    sessionId: 'session-a', fileName: 'partial.mp4', mediaType: 'video/mp4', declaredSize: 4,
  })

  const recovered = await createVideoCoordinator({
    rootDir,
    mediaEngine: readyMediaEngine(),
    now: () => startedAt + 60_000,
  })
  const recoveredInterrupted = (await recovered.list('session-a')).find(video => video.videoId === interrupted.videoId)
  assert.equal(recoveredInterrupted.status, 'failed')
  assert.equal(recoveredInterrupted.error.code, 'interrupted_by_restart')

  const expired = await createVideoCoordinator({
    rootDir,
    mediaEngine: readyMediaEngine(),
    now: () => startedAt + 8 * 24 * 60 * 60 * 1000,
  })
  assert.deepEqual(await expired.list('session-a'), [])
})

test('media preparation is bounded to two concurrent videos', async (t) => {
  const rootDir = await mkdtemp(join(tmpdir(), 'dsh-video-'))
  t.after(async () => {
    await import('node:fs/promises').then(fs => fs.rm(rootDir, { recursive: true, force: true }))
  })
  let active = 0
  let maximum = 0
  const releases = []
  let firstPairStarted
  const firstPair = new Promise(resolve => { firstPairStarted = resolve })
  let thirdStarted
  const third = new Promise(resolve => { thirdStarted = resolve })
  let starts = 0
  const engine = {
    ...readyMediaEngine(),
    async prepare(request) {
      active += 1
      starts += 1
      maximum = Math.max(maximum, active)
      if (starts === 3) thirdStarted()
      await new Promise(resolve => {
        releases.push(resolve)
        if (releases.length === 2) firstPairStarted()
      })
      active -= 1
      return readyMediaEngine().prepare(request)
    },
  }
  let nextId = 0
  const coordinator = await createVideoCoordinator({
    rootDir,
    mediaEngine: engine,
    createId: () => `video-concurrency000${++nextId}`,
  })
  const uploads = ['one', 'two', 'three'].map(value => coordinator.upload({
    sessionId: 'session-a',
    fileName: `${value}.mp4`,
    mediaType: 'video/mp4',
    declaredSize: value.length,
    body: body(value),
  }))
  await firstPair
  await new Promise(resolve => setImmediate(resolve))

  assert.equal(active, 2)
  assert.equal(releases.length, 2)
  releases.shift()()
  await third
  assert.equal(maximum, 2)
  assert.equal(releases.length, 2)
  while (releases.length > 0) releases.shift()()
  await Promise.all(uploads)
  assert.equal(maximum, 2)
})

test('prepared content is streamed through an opaque descriptor with byte ranges', async (t) => {
  const rootDir = await mkdtemp(join(tmpdir(), 'dsh-video-'))
  t.after(async () => {
    await import('node:fs/promises').then(fs => fs.rm(rootDir, { recursive: true, force: true }))
  })
  const coordinator = await createVideoCoordinator({
    rootDir,
    mediaEngine: readyMediaEngine(),
    createId: () => 'video-content0000001',
  })
  const ready = await coordinator.upload({
    sessionId: 'session-a',
    fileName: 'demo.mp4',
    mediaType: 'video/mp4',
    declaredSize: 4,
    body: body('same'),
  })

  const content = await coordinator.content(ready.videoId, 'video')
  assert.equal(content.mediaType, 'video/mp4')
  assert.equal(content.sizeBytes, 16)
  assert.match(content.etag, /^"sha256-[a-f0-9]{64}"$/)
  const chunks = []
  for await (const chunk of content.open({ start: 0, end: 5 })) chunks.push(chunk)
  assert.equal(Buffer.concat(chunks).toString(), 'normal')
})
