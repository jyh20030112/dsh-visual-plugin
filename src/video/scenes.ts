import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { CommandRunner } from './process-runner.ts'

interface SceneRange {
  start: number
  end: number
}

function parseCsvLine(line: string): string[] {
  const values: string[] = []
  let value = ''
  let quoted = false
  for (const character of line) {
    if (character === '"') quoted = !quoted
    else if (character === ',' && !quoted) {
      values.push(value)
      value = ''
    } else value += character
  }
  values.push(value)
  return values
}

async function loadSceneCsv(path: string): Promise<SceneRange[]> {
  const lines = (await readFile(path, 'utf8')).trim().split(/\r?\n/)
  const header = parseCsvLine(lines[0] ?? '')
  const startIndex = header.indexOf('Start Time (seconds)')
  const endIndex = header.indexOf('End Time (seconds)')
  if (startIndex < 0 || endIndex < 0) throw new Error('PySceneDetect CSV is missing time columns')
  return lines.slice(1).flatMap((line) => {
    const fields = parseCsvLine(line)
    const start = Number(fields[startIndex])
    const end = Number(fields[endIndex])
    return Number.isFinite(start) && Number.isFinite(end) && end > start ? [{ start, end }] : []
  })
}

function mergeRanges(ranges: readonly SceneRange[], duration: number): SceneRange[] {
  const cuts = [...new Set(ranges.flatMap(range => [range.start, range.end, 0, duration])
    .map(value => Math.max(0, Math.min(duration, value)).toFixed(3)))]
    .map(Number)
    .sort((left, right) => left - right)
  const mergedCuts: number[] = []
  for (const cut of cuts) {
    if (mergedCuts.length === 0 || cut - (mergedCuts.at(-1) ?? 0) >= 0.25) mergedCuts.push(cut)
  }
  if ((mergedCuts.at(-1) ?? 0) < duration) mergedCuts.push(duration)
  return mergedCuts.slice(0, -1).map((start, index) => ({ start, end: mergedCuts[index + 1] ?? duration }))
}

function selectTimestamps(ranges: readonly SceneRange[], duration: number, limit: number): number[] {
  const finalTimestamp = Math.max(0, duration - (1 / 15))
  const values = new Set<number>([0, finalTimestamp])
  for (const range of ranges) {
    values.add((range.start + range.end) / 2)
    if (range.end - range.start > 20) {
      for (let value = range.start + 10; value < range.end; value += 10) values.add(value)
    }
  }
  const candidates = [...values].map(value => Math.max(0, Math.min(finalTimestamp, value))).sort((a, b) => a - b)
  const deduped = candidates.filter((value, index) => index === 0 || value - candidates[index - 1] >= 0.05)
  if (deduped.length <= limit) return deduped
  const selected = [deduped[0]]
  for (let index = 1; index < limit - 1; index += 1) {
    selected.push(deduped[Math.round(index * (deduped.length - 1) / (limit - 1))])
  }
  selected.push(deduped.at(-1) ?? finalTimestamp)
  return [...new Set(selected)]
}

/** Run both required detectors and derive the bounded initial frame timestamps. */
export async function sceneTimestamps(options: {
  executable: string
  input: string
  outputDir: string
  durationSeconds: number
  limit: number
  run: CommandRunner
  signal?: AbortSignal
}): Promise<number[]> {
  const detectors = [
    { command: 'detect-adaptive', file: 'adaptive-scenes.csv' },
    { command: 'detect-threshold', file: 'threshold-scenes.csv' },
  ] as const
  const ranges: SceneRange[] = []
  for (const detector of detectors) {
    const result = await options.run(options.executable, [
      '-i', options.input,
      detector.command,
      'list-scenes', '--output', options.outputDir, '--filename', detector.file, '--skip-cuts', '--quiet',
    ], { timeoutMs: Math.min(15 * 60_000, Math.max(60_000, options.durationSeconds * 2_000)), ...(options.signal === undefined ? {} : { signal: options.signal }) })
    if (result.exitCode !== 0) throw new Error(result.stderr.trim() || `PySceneDetect ${detector.command} failed`)
    ranges.push(...await loadSceneCsv(join(options.outputDir, detector.file)))
  }
  return selectTimestamps(mergeRanges(ranges, options.durationSeconds), options.durationSeconds, options.limit)
}
