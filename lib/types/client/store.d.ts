/**
 * Vision bridge panel store: the floating panel's open/closed state, shared
 * between the sidebar toggle and the overlay entry. Panel content (config,
 * history, balance) is fetched on demand by the panel component, not held
 * here.
 * @module dsh-visual-plugin/client/store
 */
import { type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client';
/** Vision bridge panel visibility state. */
export interface VisionBridgeState {
    /** Whether the floating panel is open. */
    open: boolean;
}
/** Vision bridge panel actions (baked: callers invoke without the draft). */
export type VisionBridgeActions = {
    /** Toggle the floating panel. */
    toggle(draft: VisionBridgeState): void;
    /** Close the floating panel. */
    close(draft: VisionBridgeState): void;
};
/**
 * Create the panel store handle.
 * @returns the live store handle bound by the registering entries.
 */
export declare function createVisionBridgeStore(): EngineStoreHandle<VisionBridgeState, VisionBridgeActions>;
