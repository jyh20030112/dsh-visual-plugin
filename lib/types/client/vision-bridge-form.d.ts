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
    url: string;
    model: string;
    /** Max description-history entries per image; `null` = unlimited, `undefined` = default. */
    historyLimit?: number | null;
}
/** One field the card renders. */
export type VisionBridgeField = 'url' | 'model' | 'apiKey' | 'historyLimit';
/** A write one staged edit performs on save. */
export type VisionBridgeWrite = {
    field: 'url' | 'model';
    kind: 'set';
    value: string;
} | {
    field: 'url' | 'model';
    kind: 'clear';
} | {
    field: 'apiKey';
    kind: 'set';
    value: string;
} | {
    field: 'historyLimit';
    kind: 'set';
    value: number | null;
};
/** What a save would write, plus whether the card holds an unsaved or invalid edit. */
export interface VisionBridgePlan {
    writes: VisionBridgeWrite[];
    dirty: boolean;
    invalid: boolean;
}
/** Text shown for the default (unset) history limit. */
export declare const DEFAULT_HISTORY_LIMIT_TEXT = "20";
/** Format a history-limit value as its input text (empty = unlimited). */
export declare function historyLimitText(value: number | null | undefined): string;
/**
 * Stages one card's edits and plans the writes a save performs. Blank section
 * drafts clear the field (re-inherit the composition default); a blank apiKey
 * draft writes nothing, which keeps the stored credential; a blank history
 * limit writes `null` (unlimited).
 */
export declare class VisionBridgeForm {
    private readonly staged;
    /** Stage draft text for one field. */
    edit(field: VisionBridgeField, text: string): void;
    /** Drop every staged edit. */
    discard(): void;
    /** Draft text one field renders: the staged edit, else the section value (blank for apiKey). */
    text(field: VisionBridgeField, section: VisionBridgeSection): string;
    /** Plan the writes a save would perform, in the order the fields were staged. */
    plan(section: VisionBridgeSection): VisionBridgePlan;
}
