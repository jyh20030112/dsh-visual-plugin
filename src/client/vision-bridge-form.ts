/**
 * Pure form model for the vision-bridge settings card. Owns no React and no
 * runtime services: it stages draft text over the `vision-bridge` settings
 * section (`url` / `model`) plus a write-only credential (`apiKey`), and turns
 * the staged edits into the writes a save would perform. Mirrors the harness
 * `card-form.ts` but trimmed to this card's three fields.
 * @module dsh-visual-plugin/client/vision-bridge-form
 */

/** Effective settings values the card edits (url/model live in the section). */
export interface VisionBridgeSection {
  url: string
  model: string
}

/** One field the card renders. */
export type VisionBridgeField = 'url' | 'model' | 'apiKey'

/** A write one staged edit performs on save. */
export type VisionBridgeWrite =
  | { field: 'url' | 'model'; kind: 'set'; value: string }
  | { field: 'url' | 'model'; kind: 'clear' }
  | { field: 'apiKey'; kind: 'set'; value: string }

/** What a save would write, plus whether the card holds an unsaved edit. */
export interface VisionBridgePlan {
  writes: VisionBridgeWrite[]
  dirty: boolean
}

/** Section field names this form stages (url/model are section fields). */
const SECTION_FIELDS: ReadonlyArray<'url' | 'model'> = ['url', 'model']

/**
 * Stages one card's edits and plans the writes a save performs. Blank section
 * drafts clear the field (re-inherit the composition default); a blank apiKey
 * draft writes nothing, which keeps the stored credential rather than clearing
 * it.
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
    return section[field]
  }

  /** Plan the writes a save would perform, in the order the fields were staged. */
  plan(section: VisionBridgeSection): VisionBridgePlan {
    const writes: VisionBridgeWrite[] = []
    for (const field of SECTION_FIELDS) {
      const staged = this.staged.get(field)
      if (staged === undefined) continue
      const trimmed = staged.trim()
      if (trimmed === section[field]) continue
      if (trimmed === '') writes.push({ field, kind: 'clear' })
      else writes.push({ field, kind: 'set', value: trimmed })
    }
    const key = this.staged.get('apiKey')
    if (key !== undefined && key.trim() !== '') {
      writes.push({ field: 'apiKey', kind: 'set', value: key.trim() })
    }
    return { writes, dirty: writes.length > 0 }
  }
}
