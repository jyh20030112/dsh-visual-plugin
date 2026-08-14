/**
 * `vision.describe` tool card: a compact settled-state row showing the
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
 * Render one settled `vision.describe` call.
 * @param props - composed props for the keyed Tool slot.
 */
export function VisionDescribeCard(props: VisionDescribeCardProps): JSX.Element | null {
  const { block, t } = props
  // Only the settled form carries a description; running calls keep the
  // generic card (this entry renders null and the fallback row takes over).
  if (!('kind' in block) || block.kind !== 'tool-result') return null
  const description = descriptionOf(block.content)
  return (
    <div className={css.card}>
      <span className={css.label}>{t('panel.title')}</span>
      <p className={css.text}>{description}</p>
    </div>
  )
}
