import assert from 'node:assert/strict'
import test from 'node:test'

import { VisionActivityStore } from '../src/activity.ts'

test('folds one automatic description lifecycle into one UI activity', () => {
  let now = 10
  const store = new VisionActivityStore(10, () => now++)
  const operation = {
    operationId: 'vision-1',
    attachmentId: 'sha256:whale',
    sessionId: 'session-1',
    messageId: 'message-image',
  }

  store.start(operation, 3)
  store.complete({ ...operation, description: '一只白色鲸鱼。' })

  assert.deepEqual(store.forSession('session-1'), [{
    ...operation,
    turn: 3,
    status: 'completed',
    startedAt: 10,
    completedAt: 11,
    description: '一只白色鲸鱼。',
  }])
})

test('keeps failed and successful operations isolated by session', () => {
  const store = new VisionActivityStore()
  store.start({ operationId: 'one', attachmentId: 'a', sessionId: 'session-1' }, 1)
  store.start({ operationId: 'two', attachmentId: 'b', sessionId: 'session-2' }, 2)
  store.fail({ operationId: 'one', attachmentId: 'a', sessionId: 'session-1', error: 'boom' })

  assert.deepEqual(store.forSession('session-1').map(entry => entry.status), ['failed'])
  assert.deepEqual(store.forSession('session-2').map(entry => entry.status), ['running'])
})
