/**
 * Pure form model for the vision-bridge settings card. Owns no React and no
 * runtime services: it stages draft text over the `vision-bridge` settings
 * section (`url` / `model` / `historyLimit`) plus a write-only credential
 * (`apiKey`), and turns the staged edits into the writes a save would perform.
 * Mirrors the harness `card-form.ts` but trimmed to this card's four fields.
 * @module dsh-visual-plugin/client/vision-bridge-form
 */

/** Effective settings values the card edits (url/model/historyLimit live in the section). */
export interface VisionBridgeSection {
  url: string
  model: string
  /** Max description-history entries per image; `null` = unlimited, `undefined` = default. */
  historyLimit?: number | null
}

/** One field the card renders. */
export type VisionBridgeField = 'url' | 'model' | 'apiKey' | 'historyLimit'

/** A write one staged edit performs on save. */
export type VisionBridgeWrite =
  | { field: 'url' | 'model'; kind: 'set'; value: string }
  | { field: 'url' | 'model'; kind: 'clear' }
  | { field: 'apiKey'; kind: 'set'; value: string }
  | { field: 'historyLimit'; kind: 'set'; value: number | null }

/** What a save would write, plus whether the card holds an unsaved or invalid edit. */
export interface VisionBridgePlan {
  writes: VisionBridgeWrite[]
  dirty: boolean
  invalid: boolean
}

/** Text shown for the default (unset) history limit. */
export const DEFAULT_HISTORY_LIMIT_TEXT = '20'

/** Format a history-limit value as its input text (empty = unlimited). */
export function historyLimitText(value: number | null | undefined): string {
  if (value === undefined) return DEFAULT_HISTORY_LIMIT_TEXT
  if (value === null) return ''
  return String(value)
}

/** Section field names this form stages (url/model are free-text). */
const TEXT_FIELDS: ReadonlyArray<'url' | 'model'> = ['url', 'model']

/**
 * Stages one card's edits and plans the writes a save performs. Blank section
 * drafts clear the field (re-inherit the composition default); a blank apiKey
 * draft writes nothing, which keeps the stored credential; a blank history
 * limit writes `null` (unlimited).
 */
export class VisionBridgeForm {
  private readonly staged = new Map<VisionBridgeField, string>()

  /** Stage draft text for one field. */
  edit(field: VisionBridgeField, text: string): void {
    this.staged.set(field, text)
  }

  /** Drop every staged edit. */
  discard(): void {
    this.staged.clear()
  }

  /** Draft text one field renders: the staged edit, else the section value (blank for apiKey). */
  text(field: VisionBridgeField, section: VisionBridgeSection): string {
    const staged = this.staged.get(field)
    if (staged !== undefined) return staged
    if (field === 'apiKey') return ''
    if (field === 'historyLimit') return historyLimitText(section.historyLimit)
    return section[field]
  }

  /** Plan the writes a save would perform, in the order the fields were staged. */
  plan(section: VisionBridgeSection): VisionBridgePlan {
    const writes: VisionBridgeWrite[] = []
    let dirty = false
    let invalid = false
    for (const field of TEXT_FIELDS) {
      const staged = this.staged.get(field)
      if (staged === undefined) continue
      const trimmed = staged.trim()
      if (trimmed === section[field]) continue
      dirty = true
      if (trimmed === '') writes.push({ field, kind: 'clear' })
      else writes.push({ field, kind: 'set', value: trimmed })
    }
    const key = this.staged.get('apiKey')
    if (key !== undefined && key.trim() !== '') {
      dirty = true
      writes.push({ field: 'apiKey', kind: 'set', value: key.trim() })
    }
    const limit = this.staged.get('historyLimit')
    if (limit !== undefined) {
      const trimmed = limit.trim()
      if (trimmed === '') {
        if (section.historyLimit !== null) {
          dirty = true
          writes.push({ field: 'historyLimit', kind: 'set', value: null })
        }
      } else {
        const parsed = Number(trimmed)
        if (Number.isInteger(parsed) && parsed > 0) {
          if (parsed !== section.historyLimit) {
            dirty = true
            writes.push({ field: 'historyLimit', kind: 'set', value: parsed })
          }
        } else {
          dirty = true
          invalid = true
        }
      }
    }
    return { writes, dirty, invalid }
  }
}
