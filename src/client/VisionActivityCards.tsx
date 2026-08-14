import { useEffect, useState } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import {
  VisionDescriptionCard, type VisionDescriptionCardStatus,
} from './VisionDescribeCard.tsx'
import css from './VisionActivityCards.module.css'

/** Browser projection of one host-side automatic bridge operation. */
interface VisionActivity {
  operationId: string
  attachmentId: string
  sessionId: string
  messageId?: string
  turn?: number
  status: 'running' | 'completed' | 'failed'
  turnClosed: boolean
  description?: string
  error?: string
}

const pendingLoads = new Map<string, Promise<readonly VisionActivity[]>>()

function fetchActivities(sessionId: string): Promise<readonly VisionActivity[]> {
  const existing = pendingLoads.get(sessionId)
  if (existing !== undefined) return existing
  const pending = fetch(`/vision-bridge/activity?sessionId=${encodeURIComponent(sessionId)}`)
    .then(async response => (await response.json() as { entries?: VisionActivity[] }).entries ?? [])
    .finally(() => { pendingLoads.delete(sessionId) })
  pendingLoads.set(sessionId, pending)
  return pending
}

function useActivities(sessionId: string, poll: boolean): readonly VisionActivity[] {
  const [entries, setEntries] = useState<readonly VisionActivity[]>([])
  useEffect(() => {
    let disposed = false
    const load = async (): Promise<void> => {
      try {
        const values = await fetchActivities(sessionId)
        if (!disposed) setEntries(values)
      } catch {
        if (!disposed) setEntries([])
      }
    }
    void load()
    if (!poll) return () => { disposed = true }
    const timer = setInterval(() => { void load() }, 500)
    return () => {
      disposed = true
      clearInterval(timer)
    }
  }, [poll, sessionId])
  return entries
}

function cardStatus(entry: VisionActivity): VisionDescriptionCardStatus {
  return entry.status === 'running' && entry.turnClosed ? 'interrupted' : entry.status
}

function cardText(entry: VisionActivity, t: PropsLocale<'vision-bridge'>['t']): string {
  if (entry.status === 'completed') return entry.description ?? '…'
  if (entry.status === 'failed') return t('status.describeFail', { message: entry.error ?? 'unknown' })
  return entry.turnClosed ? t('status.interrupted') : t('status.describing')
}

function ActivityList({
  entries, t,
}: { entries: readonly VisionActivity[]; t: PropsLocale<'vision-bridge'>['t'] }): JSX.Element | null {
  if (entries.length === 0) return null
  return (
    <div className={css.list} data-vision-activity-list>
      {entries.map(entry => (
        <VisionDescriptionCard
          key={entry.operationId}
          status={cardStatus(entry)}
          label={t('panel.title')}
          text={cardText(entry, t)}
          t={t}
        />
      ))}
    </div>
  )
}

function locationClosed(location: PropsRuntime<
  'conversation.chat.node', 'vision-activity'
>['node']['location']): boolean {
  if (location.kind === 'step') {
    return location.step.status === 'closed' || location.turn.status === 'closed'
  }
  return location.kind === 'turn' && location.turn.status === 'closed'
}

/** Live and settled cards anchored directly after their source image message. */
export function InlineVisionDescriptions(
  props: PropsRuntime<'conversation.chat.node', 'vision-activity'> & PropsLocale<'vision-bridge'>,
): JSX.Element | null {
  const entries = useActivities(String(props.sessionId), !locationClosed(props.node.location))
    .filter(entry => entry.messageId === props.node.data.messageId)
  return <ActivityList entries={entries} t={props.t} />
}
