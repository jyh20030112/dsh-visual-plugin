/**
 * Pure geometry for the floating panel's resizable width. No React, no DOM:
 * the caller supplies the viewport and the pointer's client X, and gets back a
 * clamped width for the right-anchored panel.
 * @module dsh-visual-plugin/client/panel-geometry
 */

/** Minimum panel width in pixels. */
export const PANEL_MIN_WIDTH = 320

/** Maximum panel width as a fraction of the viewport width. */
export const PANEL_MAX_RATIO = 0.9

/**
 * Clamp a right-anchored panel width derived from a pointer drag. The panel's
 * left edge is `clientX`, so its width is `innerWidth - clientX`, bounded to
 * `[min, max(innerWidth * maxRatio)]`.
 * @param innerWidth - the viewport width in pixels.
 * @param clientX - the pointer's client X (the panel's left edge).
 * @param min - minimum width (default {@link PANEL_MIN_WIDTH}).
 * @param maxRatio - maximum width as a viewport fraction (default {@link PANEL_MAX_RATIO}).
 * @returns the clamped width in pixels.
 */
export function clampPanelWidth(
  innerWidth: number,
  clientX: number,
  min: number = PANEL_MIN_WIDTH,
  maxRatio: number = PANEL_MAX_RATIO,
): number {
  const max = Math.max(min, Math.round(innerWidth * maxRatio))
  const raw = Math.round(innerWidth - clientX)
  return Math.min(max, Math.max(min, raw))
}
