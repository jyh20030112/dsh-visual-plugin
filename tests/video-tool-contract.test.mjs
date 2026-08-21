import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('video_describe returns timestamped visual evidence to the current DSH text model', async () => {
  const source = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8')

  assert.match(source, /name: 'video_describe'/)
  assert.match(source, /videoCoordinator[\s\S]*\.analyze\(/)
  assert.match(source, /exec\.agent\.session\.id/)
  assert.match(source, /timestampsSeconds/)
  assert.match(source, /current text model/i)
})
