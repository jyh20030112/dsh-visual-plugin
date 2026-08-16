import assert from 'node:assert/strict'
import test from 'node:test'

import { VisionBridgeForm } from '../src/client/vision-bridge-form.ts'

const SECTION = { url: 'https://api.example.com', model: 'glm-4v' }

test('a fresh form plans no writes and echoes the section values', () => {
  const form = new VisionBridgeForm()
  assert.deepEqual(form.plan(SECTION), { writes: [], dirty: false })
  assert.equal(form.text('url', SECTION), SECTION.url)
  assert.equal(form.text('model', SECTION), SECTION.model)
  assert.equal(form.text('apiKey', SECTION), '')
})

test('editing a section field stages a trimmed set write', () => {
  const form = new VisionBridgeForm()
  form.edit('url', ' https://new.example.com ')
  assert.deepEqual(form.plan(SECTION), {
    writes: [{ field: 'url', kind: 'set', value: 'https://new.example.com' }],
    dirty: true,
  })
})

test('editing a field to its current value stages nothing', () => {
  const form = new VisionBridgeForm()
  form.edit('url', SECTION.url)
  assert.deepEqual(form.plan(SECTION), { writes: [], dirty: false })
})

test('clearing a field stages a clear write', () => {
  const form = new VisionBridgeForm()
  form.edit('model', '   ')
  assert.deepEqual(form.plan(SECTION), {
    writes: [{ field: 'model', kind: 'clear' }],
    dirty: true,
  })
})

test('a blank apiKey drafts nothing, keeping the stored key', () => {
  const form = new VisionBridgeForm()
  form.edit('apiKey', '   ')
  assert.deepEqual(form.plan(SECTION), { writes: [], dirty: false })
})

test('a non-blank apiKey drafts a credential set', () => {
  const form = new VisionBridgeForm()
  form.edit('apiKey', ' sk-123 ')
  assert.deepEqual(form.plan(SECTION), {
    writes: [{ field: 'apiKey', kind: 'set', value: 'sk-123' }],
    dirty: true,
  })
})

test('discard drops every staged edit', () => {
  const form = new VisionBridgeForm()
  form.edit('url', 'x')
  form.edit('apiKey', 'k')
  form.discard()
  assert.deepEqual(form.plan(SECTION), { writes: [], dirty: false })
})

test('writes are planned url/model first, then the credential, regardless of edit order', () => {
  const form = new VisionBridgeForm()
  form.edit('apiKey', 'k')
  form.edit('model', 'm')
  form.edit('url', 'u')
  assert.deepEqual(form.plan({ url: '', model: '' }), {
    writes: [
      { field: 'url', kind: 'set', value: 'u' },
      { field: 'model', kind: 'set', value: 'm' },
      { field: 'apiKey', kind: 'set', value: 'k' },
    ],
    dirty: true,
  })
})
