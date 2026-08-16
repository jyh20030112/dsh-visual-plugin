import assert from 'node:assert/strict'
import test from 'node:test'

import { clampPanelWidth, PANEL_MIN_WIDTH } from '../src/client/panel-geometry.ts'

test('clamps a too-narrow drag up to the minimum width', () => {
  // panel left edge at clientX = innerWidth - 100 -> raw width 100 -> min
  assert.equal(clampPanelWidth(1000, 950), PANEL_MIN_WIDTH)
})

test('clamps a too-wide drag down to the maximum ratio', () => {
  // raw width 1000 - 50 = 950 -> max = round(1000 * 0.9) = 900
  assert.equal(clampPanelWidth(1000, 50), 900)
})

test('passes through an in-range width', () => {
  assert.equal(clampPanelWidth(1000, 600), 400)
})

test('respects a custom minimum', () => {
  assert.equal(clampPanelWidth(1000, 990, 200), 200)
})

test('never falls below the minimum even for a tiny viewport', () => {
  assert.equal(clampPanelWidth(200, 150), PANEL_MIN_WIDTH)
})
