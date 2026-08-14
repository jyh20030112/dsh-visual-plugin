/**
 * Vision bridge floating panel: configure the vision endpoint, test the
 * connection, watch recent image descriptions with their thumbnails, and read
 * the remaining balance. Pure presentation: every fact arrives through the
 * composed props (the store seat, the connection inject face, and the
 * standard `useSessions` hook); the panel itself holds only transient form
 * and fetch state.
 * @module dsh-visual-plugin/client/VisionBridgePanel
 */

import { useCallback, useEffect, useState } from 'react'
import type { IApiClient } from '@deepseek-ai/dsh-host-apiproxy/client'
import type { RpcResponse } from '@deepseek-ai/dsh-host-apiproxy/api'
import type { AttachmentIdType } from '@deepseek-ai/dsh-attachment'
import type { InjectFace, PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-runtime/client'
import type { VisionBalanceResult, VisionTestResult } from '../vision.ts'
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
  /** Connection API client for settings/credentials/session reads; absent pre-connect. */
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

type PanelView = 'config' | 'recent'

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
  const [view, setView] = useState<PanelView>('config')

  // Config form state.
  const [url, setUrl] = useState('')
  const [model, setModel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [configured, setConfigured] = useState(false)
  const [keyConfigured, setKeyConfigured] = useState(false)
  const [saved, setSaved] = useState(false)

  // Test / balance / history state.
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<VisionTestResult | null>(null)
  const [balance, setBalance] = useState<VisionBalanceResult | null>(null)
  const [history, setHistory] = useState<RecentEntry[]>([])
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({})
  const [expandedHistory, setExpandedHistory] = useState<Record<string, boolean>>({})

  /** Load the stored config and key state from the host config route. */
  const loadConfig = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch('/vision-bridge/config')
      const body = await response.json() as { ok?: boolean; config?: { url: string; model: string; keyConfigured: boolean } }
      if (body.ok !== true || body.config === undefined) return
      setUrl(body.config.url ?? '')
      setModel(body.config.model ?? '')
      setConfigured((body.config.url?.length ?? 0) > 0 && (body.config.model?.length ?? 0) > 0)
      setKeyConfigured(body.config.keyConfigured ?? false)
    } catch {
      // Config route unavailable (host half absent) — leave the form empty.
    }
  }, [])

  /** Save the form: url/model plus an optional new key through the host config route. */
  const save = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch('/vision-bridge/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, model, apiKey }),
      })
      const body = await response.json() as { ok?: boolean; config?: { keyConfigured: boolean } }
      if (body.ok === true) {
        setConfigured(url.length > 0 && model.length > 0)
        setSaved(true)
        if (body.config !== undefined) setKeyConfigured(body.config.keyConfigured ?? false)
        if (apiKey.length > 0) setApiKey('')
      }
    } catch {
      // Config route unavailable — nothing to do.
    }
  }, [url, model, apiKey])

  /** POST a connection test to the host route. */
  const testConnection = useCallback(async (): Promise<void> => {
    setTesting(true)
    setTestResult(null)
    try {
      const response = await fetch('/vision-bridge/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, model, apiKey }),
      })
      setTestResult(await response.json() as VisionTestResult)
    } catch (error) {
      setTestResult({ ok: false, latencyMs: 0, error: { code: 'NETWORK', message: String(error) } })
    } finally {
      setTesting(false)
    }
  }, [url, model, apiKey])

  /** Load balance and recent history from the host routes. */
  const refresh = useCallback(async (): Promise<void> => {
    try {
      const balanceResponse = await fetch('/vision-bridge/balance')
      setBalance(await balanceResponse.json() as VisionBalanceResult)
    } catch {
      setBalance({ supported: false, error: { code: 'NETWORK', message: 'fetch failed' } })
    }
    try {
      const historyResponse = await fetch('/vision-bridge/recent')
      const body = await historyResponse.json() as { entries?: RecentEntry[] }
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

  // Refresh config/history on open, then poll the recent feed every 2s so a
  // freshly described image appears in the panel without a manual refresh.
  useEffect(() => {
    if (!open) return
    void loadConfig()
    void refresh()
    const timer = setInterval(() => { void refresh() }, 2000)
    return () => clearInterval(timer)
  }, [open, loadConfig, refresh])

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

  if (!open) return null

  return (
    <div className={css.panel} role="dialog" aria-label={t('panel.title')}>
      <header className={css.header}>
        <div>
          <span className={css.title}>{t('panel.title')}</span>
          <p className={css.headerHint}>{t('panel.shortHint')}</p>
        </div>
        <button type="button" className={css.close} onClick={actions.close} aria-label={t('action.close')}>
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg>
        </button>
      </header>

      <nav className={css.tabs} role="tablist" aria-label={t('panel.title')}>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'config'}
          className={view === 'config' ? css.tabActive : css.tab}
          onClick={() => { setView('config') }}
        >
          {t('tab.config')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'recent'}
          className={view === 'recent' ? css.tabActive : css.tab}
          onClick={() => { setView('recent') }}
        >
          {t('tab.recent')}
          {history.length > 0 && <span className={css.tabDot} aria-hidden="true" />}
        </button>
      </nav>

      <div className={css.content}>
        {view === 'config' && (
          <div role="tabpanel" className={css.view}>
            <section className={css.intro}>
              <span className={configured ? css.statusReady : css.statusPending}>
                {configured ? t('status.configured') : t('status.notConfigured')}
              </span>
              <p className={css.hint}>{t('panel.hint')}</p>
            </section>

            <section className={css.card}>
              <div className={css.sectionHeading}>
                <h2 className={css.subtitle}>{t('config.title')}</h2>
                <span>{t('config.securityHint')}</span>
              </div>
              <label className={css.field}>
                <span>{t('field.url')}</span>
                <input value={url} onChange={e => setUrl(e.target.value)} placeholder={t('field.url.placeholder')} />
              </label>
              <label className={css.field}>
                <span>{t('field.model')}</span>
                <input value={model} onChange={e => setModel(e.target.value)} placeholder={t('field.model.placeholder')} />
              </label>
              <label className={css.field}>
                <span>{t('field.apiKey')}</span>
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder={keyConfigured ? t('status.keyConfigured') : t('status.keyMissing')}
                />
              </label>
              <div className={css.actions}>
                <button type="button" className={css.primaryAction} onClick={() => void save()} disabled={api === undefined}>
                  {t('action.save')}
                </button>
                <button
                  type="button"
                  className={css.secondaryAction}
                  onClick={() => void testConnection()}
                  disabled={testing || url.length === 0 || model.length === 0}
                >
                  {testing ? t('status.testing') : t('action.test')}
                </button>
              </div>
              {saved && <p className={css.ok}>{t('status.saved')}</p>}
              {testResult !== null && (
                <p className={testResult.ok ? css.ok : css.error}>
                  {testResult.ok
                    ? t('status.testOk', { latency: String(testResult.latencyMs ?? 0) })
                    : t('status.testFail', { message: testResult.error?.message ?? 'unknown' })}
                </p>
              )}
            </section>

            <section className={css.card}>
              <div className={css.sectionHeading}>
                <h2 className={css.subtitle}>{t('balance.title')}</h2>
                <button type="button" className={css.textAction} onClick={() => void refresh()}>{t('action.refresh')}</button>
              </div>
              {balance === null && <p className={css.note}>{t('status.loading')}</p>}
              {balance !== null && !balance.supported && (
                <p className={css.note}>
                  {balance.error !== undefined ? t('balance.unavailable', { message: balance.error.message }) : t('balance.unsupported')}
                </p>
              )}
              {balance !== null && balance.supported && (balance.lines ?? []).map((line, index) => (
                <p key={`${line.currency}-${index}`} className={css.balanceLine}>
                  {t('balance.line', { currency: line.currency, available: String(line.available), total: String(line.total) })}
                </p>
              ))}
            </section>
          </div>
        )}

        {view === 'recent' && (
          <section role="tabpanel" className={css.view}>
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
        )}
      </div>
    </div>
  )
}
