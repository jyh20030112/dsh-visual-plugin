import assert from 'node:assert/strict'
import test from 'node:test'

import { visionActivityDefinition } from '../src/client/vision-activity-definition.ts'

function contextFor(event, state) {
  const result = visionActivityDefinition.match(event)
  assert.notEqual(result, null)
  const match = { event, view: undefined, role: 'start', location: { kind: 'turn' } }
  return {
    key: `vision-activity:${result.id}`,
    kind: 'vision-activity',
    id: result.id,
    matches: [match],
    start: match,
    state,
    current: new Map(),
  }
}

test('anchors automatic vision immediately after an image-bearing user message', () => {
  const event = {
    type: 'user/message',
    seq: 8,
    time: 100,
    surfaceOp: 'append',
    data: {
      id: 'message-user-image',
      role: 'user',
      source: { kind: 'user' },
      content: [{
        type: 'image',
        attachment: { attachmentId: 'sha256:cloud', mediaType: 'image/png' },
      }],
    },
  }
  const result = visionActivityDefinition.match(event)
  assert.deepEqual(result, { id: 'message-user-image', role: 'start' })
  const state = visionActivityDefinition.start(contextFor(event), contextFor(event).start, {})
  assert.deepEqual(state, {
    messageId: 'message-user-image',
    attachmentIds: ['sha256:cloud'],
  })

  assert.deepEqual(visionActivityDefinition.buildViewNode(contextFor(event, state)), {
    key: 'vision-activity:message-user-image',
    kind: 'vision-activity',
    id: 'message-user-image',
    target: 'chat',
    anchorSeq: 8.1,
    location: { kind: 'turn' },
    visibility: 'visible',
    data: state,
  })
})

test('finds nested images in a tool result and ignores image-free turn endings', () => {
  const event = {
    type: 'tool/result',
    seq: 12,
    time: 200,
    surfaceOp: 'append',
    data: {
      turn: 1,
      step: 1,
      message: {
        id: 'message-tool-image',
        role: 'user',
        source: { kind: 'tool', callId: 'read-1' },
        content: [{
          type: 'tool-result',
          toolCallId: 'read-1',
          isError: false,
          content: [{
            type: 'image',
            attachment: { attachmentId: 'sha256:palette', mediaType: 'image/png' },
          }],
        }],
      },
    },
  }

  assert.deepEqual(visionActivityDefinition.match(event), { id: 'message-tool-image', role: 'start' })
  assert.deepEqual(
    visionActivityDefinition.start(contextFor(event), contextFor(event).start, {}),
    { messageId: 'message-tool-image', attachmentIds: ['sha256:palette'] },
  )
  assert.equal(visionActivityDefinition.match({
    type: 'turn/end', seq: 13, time: 201, data: { turn: 1, reason: { kind: 'completed' } },
  }), null)
})
