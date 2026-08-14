/**
 * `vision_describe` tool card: a compact settled-state row showing the
 * returned image description. Reads only the frozen call block from the
 * keyed Tool slot; no host round-trip is needed for display.
 * @module dsh-visual-plugin/client/VisionDescribeCard
 */

import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import css from './VisionDescribeCard.module.css'

/** Injected business face of the tool card entry. */
export interface VisionDescribeCardInjected {
}

/** Full card props composed by the keyed Tool slot. */
export type VisionDescribeCardProps =
  ToolCallViewProps
  & InjectFace<VisionDescribeCardInjected>
  & PropsLocale<'vision-bridge'>

/** Shared lifecycle shown by automatic and explicit vision descriptions. */
export type VisionDescriptionCardStatus = 'running' | 'completed' | 'failed' | 'interrupted'

/** Props for the presentation-only shared card. */
export interface VisionDescriptionCardProps {
  status: VisionDescriptionCardStatus
  text: string
  label: string
}

/** One visual treatment for every description path. */
export function VisionDescriptionCard({
  status, text, label,
}: VisionDescriptionCardProps): JSX.Element {
  return (
    <div className={`${css.card} ${css[status]}`} data-vision-description-status={status}>
      <span className={css.label}>{label}</span>
      <p className={css.text}>{text}</p>
    </div>
  )
}

/** Extract the description text from a settled result node's text blocks. */
function descriptionOf(content: readonly ContentBlock[]): string {
  const texts: string[] = []
  for (const item of content) {
    if (item.type !== 'text') continue
    const text = (item as { text?: unknown }).text
    if (typeof text === 'string') texts.push(text)
  }
  return texts.join('\n') || '…'
}

/**
 * Render one settled `vision_describe` call.
 * @param props - composed props for the keyed Tool slot.
 */
export function VisionDescribeCard(props: VisionDescribeCardProps): JSX.Element | null {
  const { block, t } = props
  if (!('kind' in block)) {
    return <VisionDescriptionCard status="running" label={t('panel.title')} text={t('status.describing')} />
  }
  if (block.kind !== 'tool-result') return null
  const description = descriptionOf(block.content)
  const failed = block.isError === true
  return <VisionDescriptionCard
    status={failed ? 'failed' : 'completed'}
    label={t('panel.title')}
    text={failed ? t('status.describeFail', { message: description }) : description}
  />
}
