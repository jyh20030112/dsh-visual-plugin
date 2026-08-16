/**
 * Vision bridge floating panel: the image-history surface only. Configuration
 * now lives in the harness settings page (see `VisionBridgeCard`); this panel
 * shows recent image descriptions with their thumbnails and lets the user drag
 * its left edge to resize. Pure presentation: every fact arrives through the
 * composed props (the store seat, the connection inject face, and the standard
 * `useSessions` hook); the panel itself holds only transient fetch state.
 * @module dsh-visual-plugin/client/VisionBridgePanel
 */

import { useCallback, useEffect, useState } from 'react'
import type { IApiClient } from '@deepseek-ai/dsh-host-apiproxy/client'
import type { RpcResponse } from '@deepseek-ai/dsh-host-apiproxy/api'
import type { AttachmentIdType } from '@deepseek-ai/dsh-attachment'
import type { InjectFace, PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-runtime/client'
import { clampPanelWidth } from './panel-geometry.ts'
import { createVisionBridgeStore } from './store.ts'
import { DescriptionCopyButton } from './DescriptionCopyButton.tsx'
import css from './VisionBridgePanel.module.css'

const NS = 'vision-bridge'

/** Unwrap a unary RPC response to its business result value, or undefined on failure. */
function resultValue<T>(response: RpcResponse<T>): T | undefined {
  return response.result.ok ? response.result.value : undefined
}

/** Injected business face of the floating panel entry. */
export interface VisionBridgePanelInjected {
  /** Connection API client for session/attachment reads; absent pre-connect. */
  api: IApiClient | undefined
}

/** One retained description inside an image's history. */
interface RecentDescription {
  time: number
  description: string
}

/** One image group served by /vision-bridge/recent. */
interface RecentEntry {
  attachmentId: string
  sessionId?: string
  updatedAt: number
  descriptions: RecentDescription[]
}

/** Composed props of the `shell.overlay` entry. */
export type VisionBridgePanelProps =
  PropsRuntime<'shell.overlay', 'vision-bridge-panel'>
  & PropsStore<ReturnType<typeof createVisionBridgeStore>>
  & InjectFace<VisionBridgePanelInjected>
  & PropsLocale<'vision-bridge'>

/**
 * The floating panel body.
 * @param props - composed props for the overlay entry.
 */
export function VisionBridgePanel(props: VisionBridgePanelProps): JSX.Element | null {
  const { useStore, actions, t, api, useSessions } = props
  const open = useStore(s => s.open)
  const sessions = useSessions(s => s)
  const sessionId = sessions.current

  const [history, setHistory] = useState<RecentEntry[]>([])
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({})
  const [expandedHistory, setExpandedHistory] = useState<Record<string, boolean>>({})
  const [width, setWidth] = useState<number | undefined>(undefined)
  const [resizing, setResizing] = useState(false)

  /** Load recent image descriptions from the host route. */
  const refresh = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch('/vision-bridge/recent')
      const body = await response.json() as { entries?: RecentEntry[] }
      setHistory(body.entries ?? [])
    } catch {
      setHistory([])
    }
  }, [])

  /** Resolve one attachment's bytes for thumbnail display through the session seam. */
  const loadThumbnail = useCallback(async (attachmentId: string, ownerSessionId?: string): Promise<void> => {
    const resolvedSessionId = ownerSessionId ?? sessionId
    if (api === undefined || resolvedSessionId === undefined) return
    const result = await api.sessions.attachment({
      sessionId: resolvedSessionId,
      attachmentId: attachmentId as AttachmentIdType,
    })
    const value = resultValue(result)
    if (value !== undefined) {
      setThumbnails(prev => ({
        ...prev,
        [attachmentId]: `data:${value.attachment.mediaType};base64,${value.data}`,
      }))
    }
  }, [api, sessionId])

  // Refresh on open, then poll the recent feed every 2s so a freshly described
  // image appears in the panel without a manual refresh.
  useEffect(() => {
    if (!open) return
    void refresh()
    const timer = setInterval(() => { void refresh() }, 2000)
    return () => clearInterval(timer)
  }, [open, refresh])

  // Load every visible image so a long recent list remains useful while the
  // panel's content viewport handles vertical scrolling.
  useEffect(() => {
    if (!open) return
    for (const entry of history) {
      if (thumbnails[entry.attachmentId] === undefined) {
        void loadThumbnail(entry.attachmentId, entry.sessionId)
      }
    }
  }, [history, loadThumbnail, open, thumbnails])

  /** Begin a left-edge drag that resizes the right-anchored panel. */
  const onResizePointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    event.currentTarget.setPointerCapture(event.pointerId)
    setResizing(true)
  }
  const onResizePointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (!resizing) return
    setWidth(clampPanelWidth(window.innerWidth, event.clientX))
  }
  const onResizePointerUp = (): void => {
    setResizing(false)
  }

  // Sync the resized width to the CSS variable both the panel and the shrunk
  // app root consume, so resizing keeps the panel side-by-side with the chat
  // instead of overlaying it. An undefined width clears the variable, restoring
  // the stylesheet default.
  useEffect(() => {
    if (!open) return
    if (width === undefined) {
      document.documentElement.style.removeProperty('--vision-bridge-panel-width')
    } else {
      document.documentElement.style.setProperty('--vision-bridge-panel-width', `${width}px`)
    }
  }, [open, width])

  if (!open) return null

  return (
    <div
      className={css.panel}
      role="dialog"
      aria-label={t('panel.title')}
    >
      <div
        className={resizing ? `${css.resizeHandle} ${css.resizeHandleActive}` : css.resizeHandle}
        role="separator"
        aria-orientation="vertical"
        aria-label={t('action.resize')}
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
        onPointerCancel={onResizePointerUp}
      />
      <header className={css.header}>
        <div>
          <span className={css.title}>{t('panel.title')}</span>
          <p className={css.headerHint}>{t('panel.shortHint')}</p>
        </div>
        <button type="button" className={css.close} onClick={actions.close} aria-label={t('action.close')}>
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg>
        </button>
      </header>

      <div className={css.content}>
        <section className={css.view}>
          <div className={css.recentHeading}>
            <div>
              <h2 className={css.subtitle}>{t('history.title')}</h2>
              <p>{t('history.latestHint')}</p>
            </div>
            <button type="button" className={css.textAction} onClick={() => void refresh()}>{t('action.refresh')}</button>
          </div>

          {history.length === 0
            ? (
                <div className={css.empty}>
                  <div className={css.emptyIcon} aria-hidden="true">
                    <svg viewBox="0 0 24 24"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5z" /><circle cx="9" cy="9" r="1.5" /><path d="m5 17 4.5-4.5 3.2 3.2 2-2L20 19" /></svg>
                  </div>
                  <h3>{t('history.emptyTitle')}</h3>
                  <p>{t('history.empty')}</p>
                </div>
              )
            : (
                <div className={css.recentList}>
                  {history.map((entry) => {
                    const latest = entry.descriptions[0]
                    if (latest === undefined) return null
                    const older = entry.descriptions.slice(1)
                    const expanded = expandedHistory[entry.attachmentId] === true
                    return (
                      <article key={entry.attachmentId} className={css.entry}>
                        <div className={css.preview}>
                          {thumbnails[entry.attachmentId] === undefined
                            ? (
                                <button
                                  type="button"
                                  className={css.previewPlaceholder}
                                  onClick={() => void loadThumbnail(entry.attachmentId, entry.sessionId)}
                                >
                                  {t('history.loadPreview')}
                                </button>
                              )
                            : <img className={css.thumb} src={thumbnails[entry.attachmentId]} alt={t('history.previewAlt')} />}
                        </div>
                        <div className={css.entryBody}>
                          <div className={css.entryTopline}>
                            <span className={css.latestBadge}>{t('history.latest')}</span>
                            <time dateTime={new Date(latest.time).toISOString()}>{new Date(latest.time).toLocaleString()}</time>
                          </div>
                          <p className={css.description}>{latest.description}</p>
                          <footer className={css.entryFooter}>
                            <p className={css.meta} title={entry.attachmentId}>
                              {t('history.attachments', { id: entry.attachmentId })}
                            </p>
                            <DescriptionCopyButton text={latest.description} t={t} />
                          </footer>
                          <button
                            type="button"
                            className={expanded ? css.historyToggleExpanded : css.historyToggle}
                            aria-expanded={expanded}
                            onClick={() => {
                              setExpandedHistory(current => ({
                                ...current,
                                [entry.attachmentId]: !expanded,
                              }))
                            }}
                          >
                            <span>{expanded
                              ? t('history.collapse', { count: String(older.length) })
                              : t('history.expand', { count: String(older.length) })}</span>
                            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
                          </button>
                          {expanded && (
                            <div className={css.historyList}>
                              {older.length === 0
                                ? <p className={css.historyEmpty}>{t('history.noEarlier')}</p>
                                : older.map((description, index) => (
                                    <div key={`${description.time}-${index}`} className={css.historyItem}>
                                      <div className={css.historyItemHeader}>
                                        <time dateTime={new Date(description.time).toISOString()}>
                                          {new Date(description.time).toLocaleString()}
                                        </time>
                                        <DescriptionCopyButton text={description.description} t={t} />
                                      </div>
                                      <p>{description.description}</p>
                                    </div>
                                  ))}
                            </div>
                          )}
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
        </section>
      </div>
    </div>
  )
}
