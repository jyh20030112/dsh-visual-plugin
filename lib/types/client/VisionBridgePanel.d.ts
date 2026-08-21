/**
 * Vision bridge floating panel: image history and plugin-owned videos. Configuration
 * now lives in the harness settings page (see `VisionBridgeCard`); this panel
 * shows recent image descriptions with their thumbnails and lets the user drag
 * its left edge to resize. Pure presentation: every fact arrives through the
 * composed props (the store seat, the connection inject face, and the standard
 * `useSessions` hook); the panel itself holds only transient fetch state.
 * @module dsh-visual-plugin/client/VisionBridgePanel
 */
import type { IApiClient } from '@deepseek-ai/dsh-host-apiproxy/client';
import type { InjectFace, PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots';
import { createVisionBridgeStore } from './store.ts';
import type { VideoClientController } from './video-client-controller.ts';
/** Injected business face of the floating panel entry. */
export interface VisionBridgePanelInjected {
    /** Connection API client for session/attachment reads; absent pre-connect. */
    api: IApiClient | undefined;
    /** Shared plugin-owned upload/list controller. */
    videoController: VideoClientController;
}
/** Composed props of the `shell.overlay` entry. */
export type VisionBridgePanelProps = PropsRuntime<'shell.overlay', 'vision-bridge-panel'> & PropsStore<ReturnType<typeof createVisionBridgeStore>> & InjectFace<VisionBridgePanelInjected> & PropsLocale<'vision-bridge'>;
/**
 * The floating panel body.
 * @param props - composed props for the overlay entry.
 */
export declare function VisionBridgePanel(props: VisionBridgePanelProps): JSX.Element | null;
