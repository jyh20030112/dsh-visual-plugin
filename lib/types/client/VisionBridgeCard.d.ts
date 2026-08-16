/**
 * The vision-bridge settings card: a header naming the plugin and disclosing
 * its endpoint/model/key controls, with the save that writes them. `url` and
 * `model` are settings-section values written through the card's controller;
 * `apiKey` is a write-only credential. The card also hosts the connection test
 * and the balance readout, which are vision-bridge-specific.
 * @module dsh-visual-plugin/client/VisionBridgeCard
 */
import type { InjectFace, PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots';
import type { VisionBridgeCardFace } from './vision-bridge-card-controller.ts';
import { createVisionBridgeStore } from './store.ts';
/** Composed props of the `settings.plugin.item` entry. */
export type VisionBridgeCardProps = PropsRuntime<'settings.plugin.item'> & PropsStore<ReturnType<typeof createVisionBridgeStore>> & PropsLocale<'vision-bridge'> & InjectFace<VisionBridgeCardFace>;
/**
 * Render one vision-bridge configuration card.
 * @param props - locale copy, the card snapshot, and its form actions.
 * @returns the card, or nothing when the namespace is unavailable.
 */
export declare function VisionBridgeCard(props: VisionBridgeCardProps): JSX.Element | null;
