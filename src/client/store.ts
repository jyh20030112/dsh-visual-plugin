/**
 * Vision bridge panel store: the floating panel's open/closed state, shared
 * between the settings card's sidebar toggle and the overlay entry. The open
 * state persists to localStorage so a browser refresh keeps the panel visible
 * when the user left it open.
 * @module dsh-visual-plugin/client/store
 */

import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'

/** localStorage key under which the sidebar open state persists. */
const SIDEBAR_STORAGE_KEY = 'dsh-visual-plugin:sidebar-open'

/** Vision bridge panel visibility state. */
export interface VisionBridgeState {
  /** Whether the floating panel is open. */
  open: boolean
}

/** Vision bridge panel actions (baked: callers invoke without the draft). */
export type VisionBridgeActions = {
  /** Toggle the floating panel. */
  toggle(draft: VisionBridgeState): void
  /** Close the floating panel. */
  close(draft: VisionBridgeState): void
}

/** Read the persisted open state, defaulting to closed when unavailable. */
function readInitialOpen(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/** Persist the open state across refreshes. */
function persistOpen(open: boolean): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(SIDEBAR_STORAGE_KEY, open ? '1' : '0')
  } catch {
    // Storage unavailable (private mode / disabled) — the panel still works,
    // it just resets to closed on the next refresh.
  }
}

/**
 * Create the panel store handle.
 * @returns the live store handle bound by the registering entries.
 */
export function createVisionBridgeStore(): EngineStoreHandle<VisionBridgeState, VisionBridgeActions> {
  return defineStore<VisionBridgeState, VisionBridgeActions>({
    init: (): VisionBridgeState => ({ open: readInitialOpen() }),
    actions: {
      toggle: (d) => {
        d.open = !d.open
        persistOpen(d.open)
      },
      close: (d) => {
        d.open = false
        persistOpen(false)
      },
    },
  })
}
