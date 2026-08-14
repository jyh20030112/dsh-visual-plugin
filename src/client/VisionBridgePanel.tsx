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
import type { VisionBridgeConfigValue } from '../config.ts'
import { createVisionBridgeStore } from './store.ts'
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

/** One recent bridge activity row served by /vision-bridge/recent. */
interface RecentEntry {
  time: number
  attachmentId: string
  description: string
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

  /** Load the stored config and key state from the connection seams. */
  const loadConfig = useCallback(async (): Promise<void> => {
    if (api === undefined) return
    const describe = await api.settings.describe({})
    const value = resultValue(describe)
    if (value === undefined) return
    const section = value.namespaces.find(ns => ns.ns === NS)
    const sectionValue = (section?.value ?? {}) as VisionBridgeConfigValue
    setUrl(sectionValue?.url ?? '')
    setModel(sectionValue?.model ?? '')
    setConfigured((sectionValue?.url?.length ?? 0) > 0 && (sectionValue?.model?.length ?? 0) > 0)
    const apiKeyEnv = sectionValue?.apiKeyEnv ?? 'VISION_API_KEY'
    const creds = await api.credentials.describe({ refs: [apiKeyEnv] })
    const credsValue = resultValue(creds)
    if (credsValue !== undefined) {
      setKeyConfigured(credsValue.credentials[apiKeyEnv]?.configured ?? false)
    }
  }, [api])

  /** Save the form: url/model through settings, the key through credentials. */
  const save = useCallback(async (): Promise<void> => {
    if (api === undefined) return
    const describe = await api.settings.describe({})
    const value = resultValue(describe)
    const sectionValue = (value?.namespaces.find(ns => ns.ns === NS)?.value ?? {}) as VisionBridgeConfigValue
    const apiKeyEnv = sectionValue.apiKeyEnv || 'VISION_API_KEY'
    const updated = await api.settings.update({ ns: NS, patch: { url, model } })
    if (resultValue(updated) !== undefined) {
      setConfigured(url.length > 0 && model.length > 0)
      setSaved(true)
    }
    if (apiKey.length > 0) {
      const stored = await api.credentials.set({ ref: apiKeyEnv, value: apiKey })
      if (resultValue(stored) !== undefined) {
        setKeyConfigured(true)
        setApiKey('')
      }
    }
  }, [api, url, model, apiKey])

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
  const loadThumbnail = useCallback(async (attachmentId: string): Promise<void> => {
    if (api === undefined || sessionId === undefined) return
    const result = await api.sessions.attachment({ sessionId, attachmentId: attachmentId as AttachmentIdType })
    const value = resultValue(result)
    if (value !== undefined) {
      setThumbnails(prev => ({
        ...prev,
        [attachmentId]: `data:${value.attachment.mediaType};base64,${value.data}`,
      }))
    }
  }, [api, sessionId])

  // Refresh config/history on open.
  useEffect(() => {
    if (!open) return
    void loadConfig()
    void refresh()
  }, [open, loadConfig, refresh])

  if (!open) return null

  return (
    <div className={css.panel} role="dialog" aria-label={t('panel.title')}>
      <header className={css.header}>
        <span className={css.title}>{t('panel.title')}</span>
        <button type="button" className={css.close} onClick={actions.close} aria-label={t('panel.title')}>✕</button>
      </header>
      <p className={css.hint}>{t('panel.hint')}</p>

      <section className={css.section}>
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
          <button type="button" onClick={() => void save()} disabled={api === undefined}>{t('action.save')}</button>
          <button
            type="button"
            onClick={() => void testConnection()}
            disabled={testing || url.length === 0 || model.length === 0}
          >
            {testing ? t('status.testing') : t('action.test')}
          </button>
          <button type="button" onClick={() => void refresh()}>{t('action.refresh')}</button>
        </div>
        {saved && <p className={css.note}>{t('status.saved')}</p>}
        {!configured && <p className={css.note}>{t('status.notConfigured')}</p>}
        {testResult !== null && (
          <p className={testResult.ok ? css.ok : css.error}>
            {testResult.ok
              ? t('status.testOk', { latency: String(testResult.latencyMs ?? 0) })
              : t('status.testFail', { message: testResult.error?.message ?? 'unknown' })}
          </p>
        )}
      </section>

      <section className={css.section}>
        <h2 className={css.subtitle}>{t('balance.title')}</h2>
        {balance === null && <p className={css.note}>{t('action.refresh')}…</p>}
        {balance !== null && !balance.supported && (
          <p className={css.note}>
            {balance.error !== undefined ? t('balance.unavailable', { message: balance.error.message }) : t('balance.unsupported')}
          </p>
        )}
        {balance !== null && balance.supported && (balance.lines ?? []).map((line, index) => (
          <p key={`${line.currency}-${index}`} className={css.note}>
            {t('balance.line', { currency: line.currency, available: String(line.available), total: String(line.total) })}
          </p>
        ))}
      </section>

      <section className={css.section}>
        <h2 className={css.subtitle}>{t('history.title')}</h2>
        {history.length === 0 && <p className={css.note}>{t('history.empty')}</p>}
        {history.map((entry) => (
          <article key={entry.attachmentId} className={css.entry}>
            {thumbnails[entry.attachmentId] === undefined
              ? (
                  <button type="button" className={css.thumbPlaceholder} onClick={() => void loadThumbnail(entry.attachmentId)}>
                    img
                  </button>
                )
              : <img className={css.thumb} src={thumbnails[entry.attachmentId]} alt="" />}
            <div className={css.entryBody}>
              <p className={css.description}>{entry.description}</p>
              <p className={css.meta}>{t('history.attachments', { id: entry.attachmentId })}</p>
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}
