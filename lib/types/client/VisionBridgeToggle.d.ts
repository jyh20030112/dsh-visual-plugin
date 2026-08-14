/**
 * Vision bridge sidebar toggle: a small footer action that flips the
 * floating panel's open state through the shared store.
 * @module dsh-visual-plugin/client/VisionBridgeToggle
 */
import type { InjectFace, PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots';
import { createVisionBridgeStore } from './store.ts';
/** Injected business face of the sidebar toggle entry. */
export interface VisionBridgeToggleInjected {
}
/** Composed props of the `sidebar.footer.action` entry. */
export type VisionBridgeToggleProps = PropsRuntime<'sidebar.footer.action', 'vision-bridge-toggle'> & PropsStore<ReturnType<typeof createVisionBridgeStore>> & InjectFace<VisionBridgeToggleInjected> & PropsLocale<'vision-bridge'>;
/**
 * The sidebar toggle button; the label comes from the shared store's open
 * state.
 * @param props - composed props for the footer-action entry.
 */
export declare function VisionBridgeToggle(props: VisionBridgeToggleProps): JSX.Element;
