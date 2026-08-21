import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import test from 'node:test'

import { createSystemMediaEngine } from '../src/video/media-engine.ts'
import { runCommand } from '../src/video/process-runner.ts'

const execFileAsync = promisify(execFile)

function commandResult(stdout, exitCode = 0, stderr = '') {
  return { stdout, stderr, exitCode }
}

test('video health accepts compatible tools and reports optional acceleration separately', async () => {
  const outputs = new Map([
    ['ffmpeg|-version', commandResult('ffmpeg version 6.1.2 Copyright')],
    ['ffprobe|-version', commandResult('ffprobe version 6.1.2 Copyright')],
    ['scenedetect|version', commandResult('PySceneDetect 0.7.1')],
    ['ffmpeg|-hide_banner|-encoders', commandResult(' V....D libx264 H.264\n V....D h264_nvenc NVIDIA NVENC')],
    ['ffmpeg|-hide_banner|-filters', commandResult(' ... scale\n ... fps\n ... bwdif\n ... zscale\n ... tonemap')],
    ['scenedetect|help|detect-adaptive', commandResult('Usage: scenedetect detect-adaptive')],
    ['scenedetect|help|detect-threshold', commandResult('Usage: scenedetect detect-threshold')],
  ])
  const engine = createSystemMediaEngine({
    run: async (executable, args) => outputs.get([executable, ...args].join('|')) ?? commandResult('', 1, 'unexpected'),
  })

  assert.deepEqual(await engine.health(), {
    available: true,
    ffmpeg: { version: '6.1.2' },
    ffprobe: { version: '6.1.2' },
    sceneDetect: { version: '0.7.1' },
    features: {
      libx264: true,
      nvenc: true,
      hdrToneMap: true,
      deinterlace: true,
    },
    issues: [],
  })
})

test('video health fails closed when PySceneDetect is absent without hiding FFmpeg facts', async () => {
  const engine = createSystemMediaEngine({
    run: async (executable, args) => {
      const command = [executable, ...args].join(' ')
      if (command === 'ffmpeg -version') return commandResult('ffmpeg version 9.0.1')
      if (command === 'ffprobe -version') return commandResult('ffprobe version 9.0.1')
      if (command === 'ffmpeg -hide_banner -encoders') return commandResult(' V....D libx264 H.264')
      if (command === 'ffmpeg -hide_banner -filters') return commandResult(' scale fps bwdif zscale tonemap')
      return commandResult('', 127, 'command not found')
    },
  })

  const health = await engine.health()
  assert.equal(health.available, false)
  assert.deepEqual(health.ffmpeg, { version: '9.0.1' })
  assert.deepEqual(health.sceneDetect, undefined)
  assert.ok(health.issues.some(issue => issue.code === 'scenedetect_unavailable'))
})

test('transparent input is composited onto neutral gray before yuv420p conversion', async () => {
  const source = await readFile(new URL('../src/video/media-engine.ts', import.meta.url), 'utf8')
  assert.match(source, /input\.stream\.alpha[\s\S]*format=rgba[\s\S]*alpha\(X,Y\)[\s\S]*\+128\*/)
})

test('media preparation produces a verified h264 video, poster, and scene frames', async (t) => {
  const rootDir = await mkdtemp(join(tmpdir(), 'dsh-media-'))
  t.after(() => rm(rootDir, { recursive: true, force: true }))
  const sourceFile = join(rootDir, 'clip.mp4')
  const outputDir = join(rootDir, 'output')
  await mkdir(outputDir)
  await execFileAsync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', 'color=c=red:s=320x240:r=30:d=1.5',
    '-f', 'lavfi', '-i', 'color=c=green:s=320x240:r=30:d=1.5',
    '-f', 'lavfi', '-i', 'color=c=blue:s=320x240:r=30:d=1.5',
    '-filter_complex', '[0:v][1:v][2:v]concat=n=3:v=1:a=0[out]',
    '-map', '[out]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', sourceFile,
  ])

  const run = async (executable, args, options) => {
    if (executable !== 'scenedetect') return runCommand(executable, args, options)
    if (args[0] === 'version') return commandResult('PySceneDetect 0.7.1')
    if (args[0] === 'help') return commandResult(`Usage: scenedetect ${args[1]}`)
    const outputIndex = args.indexOf('--output')
    const filenameIndex = args.indexOf('--filename')
    assert.notEqual(outputIndex, -1)
    assert.notEqual(filenameIndex, -1)
    const csv = [
      'Scene Number,Start Frame,Start Timecode,Start Time (seconds),End Frame,End Timecode,End Time (seconds),Length (frames),Length (timecode),Length (seconds)',
      '1,0,00:00:00.000,0.000,23,00:00:01.533,1.533,23,00:00:01.533,1.533',
      '2,23,00:00:01.533,1.533,45,00:00:03.000,3.000,22,00:00:01.467,1.467',
      '3,45,00:00:03.000,3.000,68,00:00:04.533,4.533,23,00:00:01.533,1.533',
    ].join('\n')
    await writeFile(join(args[outputIndex + 1], args[filenameIndex + 1]), `${csv}\n`)
    return commandResult('')
  }
  const engine = createSystemMediaEngine({ run })
  const prepared = await engine.prepare({
    videoId: 'video-integration0001',
    sourceFile,
    originalFileName: 'clip.mp4',
    outputDir,
    onStatus: async () => {},
  })

  assert.equal(prepared.normalizedFile, 'normalized.mp4')
  assert.equal(prepared.posterFile, 'poster.jpg')
  assert.equal(prepared.width, 320)
  assert.equal(prepared.height, 240)
  assert.ok(Math.abs(prepared.durationSeconds - 4.5) < 0.2)
  assert.ok(prepared.frames.length >= 4)
  await access(join(outputDir, prepared.normalizedFile))
  await access(join(outputDir, prepared.posterFile))
  for (const frame of prepared.frames) {
    assert.ok((await readFile(join(outputDir, frame.file))).byteLength > 0)
    assert.ok((await readFile(join(outputDir, frame.highResolutionFile))).byteLength > 0)
  }

  const probe = JSON.parse((await execFileAsync('ffprobe', [
    '-v', 'error', '-show_entries', 'stream=codec_name,pix_fmt', '-of', 'json',
    join(outputDir, prepared.normalizedFile),
  ])).stdout)
  assert.deepEqual(probe.streams[0], { codec_name: 'h264', pix_fmt: 'yuv420p' })
})
