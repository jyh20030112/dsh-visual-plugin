import assert from 'node:assert/strict'
import test from 'node:test'

import { historyLimitText, VisionBridgeForm } from '../src/client/vision-bridge-form.ts'

const SECTION = { url: 'https://api.example.com', model: 'glm-4v' }

test('a fresh form plans no writes and echoes the section values', () => {
  const form = new VisionBridgeForm()
  assert.deepEqual(form.plan(SECTION), { writes: [], dirty: false, invalid: false })
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
    invalid: false,
  })
})

test('editing a field to its current value stages nothing', () => {
  const form = new VisionBridgeForm()
  form.edit('url', SECTION.url)
  assert.deepEqual(form.plan(SECTION), { writes: [], dirty: false, invalid: false })
})

test('clearing a field stages a clear write', () => {
  const form = new VisionBridgeForm()
  form.edit('model', '   ')
  assert.deepEqual(form.plan(SECTION), {
    writes: [{ field: 'model', kind: 'clear' }],
    dirty: true,
    invalid: false,
  })
})

test('a blank apiKey drafts nothing, keeping the stored key', () => {
  const form = new VisionBridgeForm()
  form.edit('apiKey', '   ')
  assert.deepEqual(form.plan(SECTION), { writes: [], dirty: false, invalid: false })
})

test('a non-blank apiKey drafts a credential set', () => {
  const form = new VisionBridgeForm()
  form.edit('apiKey', ' sk-123 ')
  assert.deepEqual(form.plan(SECTION), {
    writes: [{ field: 'apiKey', kind: 'set', value: 'sk-123' }],
    dirty: true,
    invalid: false,
  })
})

test('discard drops every staged edit', () => {
  const form = new VisionBridgeForm()
  form.edit('url', 'x')
  form.edit('apiKey', 'k')
  form.discard()
  assert.deepEqual(form.plan(SECTION), { writes: [], dirty: false, invalid: false })
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
    invalid: false,
  })
})

test('history limit formats undefined as the default, null as empty, number as text', () => {
  assert.equal(historyLimitText(undefined), '20')
  assert.equal(historyLimitText(null), '')
  assert.equal(historyLimitText(30), '30')
})

test('a blank history limit drafts an unlimited (null) write', () => {
  const form = new VisionBridgeForm()
  form.edit('historyLimit', '   ')
  assert.deepEqual(form.plan({ url: '', model: '', historyLimit: 20 }), {
    writes: [{ field: 'historyLimit', kind: 'set', value: null }],
    dirty: true,
    invalid: false,
  })
})

test('a numeric history limit drafts a set write', () => {
  const form = new VisionBridgeForm()
  form.edit('historyLimit', ' 30 ')
  assert.deepEqual(form.plan({ url: '', model: '', historyLimit: 20 }), {
    writes: [{ field: 'historyLimit', kind: 'set', value: 30 }],
    dirty: true,
    invalid: false,
  })
})

test('a non-numeric history limit marks the form invalid and blocks save', () => {
  const form = new VisionBridgeForm()
  form.edit('historyLimit', 'abc')
  const plan = form.plan({ url: '', model: '', historyLimit: 20 })
  assert.equal(plan.invalid, true)
  assert.equal(plan.dirty, true)
})
