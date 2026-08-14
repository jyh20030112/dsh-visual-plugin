import assert from 'node:assert/strict'
import test from 'node:test'

import { isSameTurnAttachmentToolCall } from '../src/turn-guard.ts'

const attachmentId = 'sha256:castle'

test('detects a vision tool call made in the same turn that introduced the image', () => {
  const events = [
    { type: 'step/start', data: { turn: 3, step: 1 } },
    {
      type: 'user/message',
      data: { content: [{ type: 'image', attachment: { attachmentId } }] },
    },
    { type: 'tool/call', data: { turn: 3, step: 1, callId: 'call-1' } },
  ]

  assert.equal(isSameTurnAttachmentToolCall(events, attachmentId, 'call-1'), true)
})

test('allows a vision tool call from a later follow-up turn', () => {
  const events = [
    { type: 'step/start', data: { turn: 3, step: 1 } },
    {
      type: 'user/message',
      data: { content: [{ type: 'image', attachment: { attachmentId } }] },
    },
    { type: 'step/end', data: { turn: 3, step: 1 } },
    { type: 'step/start', data: { turn: 4, step: 1 } },
    { type: 'user/message', data: { content: [{ type: 'text', text: '图中的城堡在哪里？' }] } },
    { type: 'tool/call', data: { turn: 4, step: 1, callId: 'call-2' } },
  ]

  assert.equal(isSameTurnAttachmentToolCall(events, attachmentId, 'call-2'), false)
})
