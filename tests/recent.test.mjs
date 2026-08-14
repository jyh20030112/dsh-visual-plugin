import assert from 'node:assert/strict'
import test from 'node:test'

import { recordRecent } from '../src/recent.ts'

test('retains multiple intent-specific descriptions for one attachment', () => {
  const recent = []

  recordRecent(recent, {
    time: 100,
    attachmentId: 'sha256:whale',
    description: 'automatic description',
  }, 20, 20)
  recordRecent(recent, {
    time: 200,
    attachmentId: 'sha256:whale',
    description: 'follow-up description',
  }, 20, 20)

  assert.equal(recent.length, 1)
  assert.deepEqual(recent[0].descriptions.map(entry => entry.description), [
    'follow-up description',
    'automatic description',
  ])
})

test('moves the most recently updated image to the front without removing other images', () => {
  const recent = []

  recordRecent(recent, { time: 100, attachmentId: 'a', description: 'A1' }, 3, 3)
  recordRecent(recent, { time: 200, attachmentId: 'b', description: 'B1' }, 3, 3)
  recordRecent(recent, { time: 300, attachmentId: 'a', description: 'A2' }, 3, 3)

  assert.deepEqual(recent.map(entry => entry.attachmentId), ['a', 'b'])
  assert.deepEqual(recent[0].descriptions.map(entry => entry.description), ['A2', 'A1'])
  assert.deepEqual(recent[1].descriptions.map(entry => entry.description), ['B1'])
})

test('bounds both image groups and each image description history', () => {
  const recent = []

  recordRecent(recent, { time: 100, attachmentId: 'a', description: 'A1' }, 2, 2)
  recordRecent(recent, { time: 200, attachmentId: 'a', description: 'A2' }, 2, 2)
  recordRecent(recent, { time: 300, attachmentId: 'a', description: 'A3' }, 2, 2)
  assert.deepEqual(recent[0].descriptions.map(entry => entry.description), ['A3', 'A2'])

  recordRecent(recent, { time: 400, attachmentId: 'b', description: 'B1' }, 2, 2)
  recordRecent(recent, { time: 500, attachmentId: 'c', description: 'C1' }, 2, 2)

  assert.deepEqual(recent.map(entry => entry.attachmentId), ['c', 'b'])
  assert.deepEqual(recent.find(entry => entry.attachmentId === 'a'), undefined)
})
