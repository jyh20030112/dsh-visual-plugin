import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { inspectVideo } from '../src/video/probe.ts'

function aviBytes() {
  const bytes = Buffer.alloc(16)
  bytes.write('RIFF', 0, 'ascii')
  bytes.write('AVI ', 8, 'ascii')
  return bytes
}

function probeJson(patch = {}) {
  return JSON.stringify({
    format: { format_name: 'avi', duration: '4.0', tags: patch.tags ?? {} },
    streams: patch.streams ?? [{
      index: 0,
      codec_type: 'video',
      codec_name: 'mpeg4',
      pix_fmt: 'yuv420p',
      width: 640,
      height: 360,
      avg_frame_rate: '30/1',
      disposition: { default: 1, attached_pic: 0 },
    }],
  })
}

test('container inspection rejects renamed files even when FFprobe can decode them', async (t) => {
  const rootDir = await mkdtemp(join(tmpdir(), 'dsh-probe-'))
  t.after(() => rm(rootDir, { recursive: true, force: true }))
  const path = join(rootDir, 'upload')
  await writeFile(path, aviBytes())
  const run = async () => ({ stdout: probeJson(), stderr: '', exitCode: 0 })

  const valid = await inspectVideo({ path, originalFileName: 'clip.avi', ffprobe: 'ffprobe', run })
  assert.equal(valid.family, 'avi')
  await assert.rejects(
    inspectVideo({ path, originalFileName: 'renamed.mp4', ffprobe: 'ffprobe', run }),
    error => error.code === 'container_mismatch',
  )
  await assert.rejects(
    inspectVideo({ path, originalFileName: 'clip.avi.exe', ffprobe: 'ffprobe', run }),
    error => error.code === 'unsupported_container',
  )
})

test('container inspection rejects DRM markers and ambiguous video streams', async (t) => {
  const rootDir = await mkdtemp(join(tmpdir(), 'dsh-probe-'))
  t.after(() => rm(rootDir, { recursive: true, force: true }))
  const path = join(rootDir, 'upload')
  await writeFile(path, aviBytes())

  await assert.rejects(
    inspectVideo({
      path,
      originalFileName: 'clip.avi',
      ffprobe: 'ffprobe',
      run: async () => ({ stdout: probeJson({ tags: { encryption: 'protected' } }), stderr: '', exitCode: 0 }),
    }),
    error => error.code === 'protected_video',
  )
  const streams = [0, 1].map(index => ({
    index,
    codec_type: 'video',
    codec_name: 'mpeg4',
    pix_fmt: 'yuv420p',
    width: 640,
    height: 360,
    disposition: { default: 0, attached_pic: 0 },
  }))
  await assert.rejects(
    inspectVideo({
      path,
      originalFileName: 'clip.avi',
      ffprobe: 'ffprobe',
      run: async () => ({ stdout: probeJson({ streams }), stderr: '', exitCode: 0 }),
    }),
    error => error.code === 'multiple_video_streams',
  )
})
