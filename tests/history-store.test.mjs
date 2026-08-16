import assert from 'node:assert/strict'
import test from 'node:test'
import { appendFile, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { fileNameFor, load, record } from '../src/history-store.ts'

test('fileNameFor strips the algo: prefix and appends .jsonl', () => {
  assert.equal(fileNameFor('sha256:be3ebaf6258b5e2767'), 'be3ebaf6258b5e2767.jsonl')
  assert.equal(fileNameFor('blake3:abc123'), 'abc123.jsonl')
})

test('record + load round-trips records', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-history-'))
  try {
    const a = { attachmentId: 'sha256:aaa', sessionId: 's1', time: 100, description: 'desc-a' }
    const b = { attachmentId: 'sha256:bbb', sessionId: 's2', time: 200, description: 'desc-b' }
    await record(dir, a)
    await record(dir, b)
    const records = await load(dir)
    assert.equal(records.length, 2)
    assert.deepEqual(records.find(r => r.attachmentId === 'sha256:aaa'), a)
    assert.deepEqual(records.find(r => r.attachmentId === 'sha256:bbb'), b)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('load returns an empty list for a missing directory', async () => {
  const records = await load(join(tmpdir(), 'dsh-history-does-not-exist'))
  assert.deepEqual(records, [])
})

test('load skips corrupt lines and non-jsonl files, keeping valid records', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-history-'))
  try {
    await record(dir, { attachmentId: 'sha256:aaa', sessionId: 's1', time: 100, description: 'ok' })
    await appendFile(join(dir, fileNameFor('sha256:aaa')), '{not json}\n')
    await writeFile(join(dir, 'ignore.txt'), 'not a jsonl file')
    const records = await load(dir)
    assert.equal(records.length, 1)
    assert.equal(records[0].description, 'ok')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
