/**
 * Vision bridge floating panel: configure the vision endpoint, test the
 * connection, watch recent image descriptions with their thumbnails, and read
 * the remaining balance. Pure presentation: every fact arrives through the
 * composed props (the store seat, the connection inject face, and the
 * standard `useSessions` hook); the panel itself holds only transient form
 * and fetch state.
 * @module dsh-visual-plugin/client/VisionBridgePanel
 */
import type { IApiClient } from '@deepseek-ai/dsh-host-apiproxy/client';
import type { InjectFace, PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots';
import { createVisionBridgeStore } from './store.ts';
/** Injected business face of the floating panel entry. */
export interface VisionBridgePanelInjected {
    /** Connection API client for settings/credentials/session reads; absent pre-connect. */
    api: IApiClient | undefined;
}
/** Composed props of the `shell.overlay` entry. */
export type VisionBridgePanelProps = PropsRuntime<'shell.overlay', 'vision-bridge-panel'> & PropsStore<ReturnType<typeof createVisionBridgeStore>> & InjectFace<VisionBridgePanelInjected> & PropsLocale<'vision-bridge'>;
/**
 * The floating panel body.
 * @param props - composed props for the overlay entry.
 */
export declare function VisionBridgePanel(props: VisionBridgePanelProps): JSX.Element | null;
