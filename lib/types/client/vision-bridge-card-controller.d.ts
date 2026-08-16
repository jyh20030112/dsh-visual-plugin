/**
 * The vision-bridge settings card's staged form. Unlike the harness's shipped
 * plugin cards, the `vision-bridge` settings namespace is NOT on the settings
 * web gateway's allowlist, so the card cannot bind it through `settingsScope`
 * (it would read `settings-not-exposed` forever). It instead reads and writes
 * the bridge config through the same-origin `/vision-bridge/config` route the
 * Host exposes: `url`/`model`/`historyLimit` are settings-section values,
 * `apiKey` is a write-only credential the Host stores through the credentials
 * seam.
 * @module dsh-visual-plugin/client/vision-bridge-card-controller
 */
import { type SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client';
import { type VisionBridgeField } from './vision-bridge-form.ts';
/** What the card renders. */
export interface VisionBridgeCardState {
    available: boolean;
    writable: boolean;
    dirty: boolean;
    invalid: boolean;
    saving: boolean;
    failed: boolean;
    url: string;
    model: string;
    apiKey: string;
    historyLimit: string;
    apiKeyConfigured: boolean;
}
/** The write actions the card's slot entry injects. */
export interface VisionBridgeCardActions {
    edit(field: VisionBridgeField, text: string): void;
    discard(): void;
    save(): void;
}
/** The registration-side face the card's slot entry injects. */
export interface VisionBridgeCardFace extends VisionBridgeCardActions {
    hooks: {
        visionBridgeCard: SnapshotStore<VisionBridgeCardState>;
    };
}
/** Bridges the same-origin config route onto the card's staged form. */
export declare class VisionBridgeCardController {
    private readonly form;
    private readonly store;
    private section;
    private apiKeyConfigured;
    private available;
    private saving;
    private failed;
    constructor();
    private projection;
    /** Load the stored config and key state from the host config route. */
    private load;
    /** Build the card's face for the slot registration. */
    inject(): VisionBridgeCardFace;
    /**
     * Write every staged edit through the host config route, then re-seed from
     * what the Host accepted. A save that did not land keeps its drafts so the
     * user can correct them.
     */
    private save;
    private publish;
}
