/**
 * `vision_describe` tool card: a compact settled-state row showing the
 * returned image description. Reads only the frozen call block from the
 * keyed Tool slot; no host round-trip is needed for display.
 * @module dsh-visual-plugin/client/VisionDescribeCard
 */
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client';
/** Injected business face of the tool card entry. */
export interface VisionDescribeCardInjected {
}
/** Full card props composed by the keyed Tool slot. */
export type VisionDescribeCardProps = ToolCallViewProps & InjectFace<VisionDescribeCardInjected> & PropsLocale<'vision-bridge'>;
/** Shared lifecycle shown by automatic and explicit vision descriptions. */
export type VisionDescriptionCardStatus = 'running' | 'completed' | 'failed' | 'interrupted';
/** Props for the presentation-only shared card. */
export interface VisionDescriptionCardProps {
    status: VisionDescriptionCardStatus;
    text: string;
    label: string;
}
/** One visual treatment for every description path. */
export declare function VisionDescriptionCard({ status, text, label, }: VisionDescriptionCardProps): JSX.Element;
/**
 * Render one settled `vision_describe` call.
 * @param props - composed props for the keyed Tool slot.
 */
export declare function VisionDescribeCard(props: VisionDescribeCardProps): JSX.Element | null;
