/**
 * The vision-bridge settings card: a header naming the plugin and disclosing
 * its endpoint/model/key controls, with the save that writes them. `url` and
 * `model` are settings-section values written through the card's controller;
 * `apiKey` is a write-only credential. The card also hosts the connection test
 * and the balance readout, which are vision-bridge-specific.
 * @module dsh-visual-plugin/client/VisionBridgeCard
 */

import { useEffect, useState } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type { VisionBridgeCardFace } from './vision-bridge-card-controller.ts'
import type { VisionBalanceResult, VisionTestResult } from '../vision.ts'
import { createVisionBridgeStore } from './store.ts'
import css from './VisionBridgeCard.module.css'

/** Composed props of the `settings.plugin.item` entry. */
export type VisionBridgeCardProps =
  PropsRuntime<'settings.plugin.item'>
  & PropsStore<ReturnType<typeof createVisionBridgeStore>>
  & PropsLocale<'vision-bridge'>
  & InjectFace<VisionBridgeCardFace>

/**
 * Render one vision-bridge configuration card.
 * @param props - locale copy, the card snapshot, and its form actions.
 * @returns the card, or nothing when the namespace is unavailable.
 */
export function VisionBridgeCard(props: VisionBridgeCardProps): JSX.Element | null {
  const { t, useStore, actions } = props
  const state = props.useVisionBridgeCard(snapshot => snapshot)
  const sidebarOpen = useStore(s => s.open)
  const [open, setOpen] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<VisionTestResult | null>(null)
  const [balance, setBalance] = useState<VisionBalanceResult | null>(null)

  useEffect(() => {
    if (!open) return
    void loadBalance()
  }, [open])

  if (!state.available) return null

  const title = t('settings.title')
  const blocked = !state.dirty || state.saving
  const canTest = !testing && state.url.trim() !== '' && state.model.trim() !== ''

  /** POST a connection test to the host route, using the staged drafts. */
  async function runTest(): Promise<void> {
    setTesting(true)
    setTestResult(null)
    try {
      const response = await fetch('/vision-bridge/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: state.url, model: state.model, apiKey: state.apiKey }),
      })
      setTestResult(await response.json() as VisionTestResult)
    } catch (error) {
      setTestResult({ ok: false, latencyMs: 0, error: { code: 'NETWORK', message: String(error) } })
    } finally {
      setTesting(false)
    }
  }

  /** Load the configured endpoint's remaining balance. */
  async function loadBalance(): Promise<void> {
    try {
      const response = await fetch('/vision-bridge/balance')
      setBalance(await response.json() as VisionBalanceResult)
    } catch {
      setBalance({ supported: false, error: { code: 'NETWORK', message: 'fetch failed' } })
    }
  }

  return (
    <li className={open ? `${css.card} ${css.cardOpen}` : css.card}>
      <button
        type="button"
        className={css.header}
        aria-expanded={open}
        onClick={() => { setOpen(!open) }}
      >
        <span className={css.headText}>
          <span className={css.name}>{title}</span>
          <span className={css.description}>{t('settings.description')}</span>
        </span>
        {state.dirty ? <span className={css.pending}>{t('action.unsaved')}</span> : null}
        <svg className={open ? `${css.chevron} ${css.chevronOpen}` : css.chevron} viewBox="0 0 16 16" aria-hidden="true">
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>

      {open ? (
        <div className={css.body}>
          {!state.writable ? <p className={css.readOnly} role="status">{t('settings.readOnly')}</p> : null}

          <div className={css.sidebarRow}>
            <div className={css.sidebarText}>
              <span className={css.sidebarLabel}>{t('settings.sidebar')}</span>
              <p className={css.sidebarHint}>{t('settings.sidebarHint')}</p>
            </div>
            <button
              type="button"
              className={css.toggle}
              role="switch"
              aria-checked={sidebarOpen}
              aria-label={t('settings.sidebar')}
              onClick={actions.toggle}
            >
              <span className={css.toggleTrack} data-on={sidebarOpen || undefined} aria-hidden="true">
                <span className={css.toggleThumb} />
              </span>
            </button>
          </div>

          <label className={css.field}>
            <span className={css.label}>{t('field.url')}</span>
            <input
              className={css.input}
              type="text"
              value={state.url}
              placeholder={t('field.url.placeholder')}
              disabled={!state.writable}
              onChange={(event) => { props.edit('url', event.target.value) }}
            />
            <p className={css.hint}>{t('field.url.hint')}</p>
          </label>

          <label className={css.field}>
            <span className={css.label}>{t('field.model')}</span>
            <input
              className={css.input}
              type="text"
              value={state.model}
              placeholder={t('field.model.placeholder')}
              disabled={!state.writable}
              onChange={(event) => { props.edit('model', event.target.value) }}
            />
            <p className={css.hint}>{t('field.model.hint')}</p>
          </label>

          <div className={css.field}>
            <div className={css.fieldHead}>
              <label className={css.label}>{t('field.apiKey')}</label>
              <span className={state.apiKeyConfigured ? css.badge : css.badgeMuted}>
                {state.apiKeyConfigured ? t('status.keyConfigured') : t('status.keyMissing')}
              </span>
            </div>
            <input
              className={css.input}
              type="password"
              autoComplete="off"
              value={state.apiKey}
              placeholder={t('field.apiKey.placeholder')}
              disabled={!state.writable}
              onChange={(event) => { props.edit('apiKey', event.target.value) }}
            />
            <p className={css.hint}>{t('field.apiKey.hint')}</p>
          </div>

          <div className={css.testRow}>
            <button type="button" className={css.testButton} disabled={!canTest} onClick={() => { void runTest() }}>
              {testing ? t('status.testing') : t('action.test')}
            </button>
            {testResult !== null ? (
              <span className={testResult.ok ? css.ok : css.error}>
                {testResult.ok
                  ? t('status.testOk', { latency: String(testResult.latencyMs ?? 0) })
                  : t('status.testFail', { message: testResult.error?.message ?? 'unknown' })}
              </span>
            ) : null}
          </div>

          <div className={css.balanceRow}>
            <span className={css.balanceTitle}>{t('balance.title')}</span>
            <button type="button" className={css.refreshButton} onClick={() => { void loadBalance() }}>
              {t('action.refresh')}
            </button>
          </div>
          {balance !== null && !balance.supported ? (
            <p className={css.note}>
              {balance.error !== undefined ? t('balance.unavailable', { message: balance.error.message }) : t('balance.unsupported')}
            </p>
          ) : null}
          {balance !== null && balance.supported ? (balance.lines ?? []).map((line, index) => (
            <p key={`${line.currency}-${index}`} className={css.balanceLine}>
              {t('balance.line', { currency: line.currency, available: String(line.available), total: String(line.total) })}
            </p>
          )) : null}

          <div className={css.footer}>
            {state.failed ? <p className={css.failed} role="status">{t('action.saveFailed')}</p> : null}
            <button
              type="button"
              className={css.discard}
              disabled={!state.dirty || state.saving}
              onClick={props.discard}
            >
              {t('action.discard')}
            </button>
            <button type="button" className={css.save} disabled={blocked} onClick={props.save}>
              {t(state.saving ? 'action.saving' : 'action.save')}
            </button>
          </div>
        </div>
      ) : null}
    </li>
  )
}
