import assert from 'node:assert/strict'
import test from 'node:test'

import { upsertRecent } from '../src/recent.ts'

test('keeps one newest recent entry per attachment', () => {
  const recent = []

  upsertRecent(recent, {
    time: 100,
    attachmentId: 'sha256:whale',
    description: 'automatic description',
  }, 20)
  upsertRecent(recent, {
    time: 200,
    attachmentId: 'sha256:whale',
    description: 'follow-up description',
  }, 20)

  assert.deepEqual(recent, [{
    time: 200,
    attachmentId: 'sha256:whale',
    description: 'follow-up description',
  }])
})

test('moves an updated attachment to the front and still enforces the limit', () => {
  const recent = []

  upsertRecent(recent, { time: 100, attachmentId: 'a', description: 'A1' }, 2)
  upsertRecent(recent, { time: 200, attachmentId: 'b', description: 'B1' }, 2)
  upsertRecent(recent, { time: 300, attachmentId: 'a', description: 'A2' }, 2)
  upsertRecent(recent, { time: 400, attachmentId: 'c', description: 'C1' }, 2)

  assert.deepEqual(recent.map(entry => entry.attachmentId), ['c', 'a'])
  assert.equal(recent[1].description, 'A2')
})
