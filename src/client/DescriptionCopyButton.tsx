import { useCallback, useEffect, useRef, useState } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import css from './DescriptionCopyButton.module.css'

/** Copy text even on plain-HTTP deployments where Clipboard API is absent. */
async function copyText(text: string): Promise<void> {
  if (navigator.clipboard !== undefined) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch {
      // Clipboard API commonly rejects on non-HTTPS remote deployments. Fall
      // through to the selection-based browser command in that case.
    }
  }
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.append(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  textarea.remove()
  if (!copied) throw new Error('copy command failed')
}

/** Compact copy action shared by inline and panel descriptions. */
export function DescriptionCopyButton({
  text, t,
}: { text: string; t: PropsLocale<'vision-bridge'>['t'] }): JSX.Element {
  const [copied, setCopied] = useState(false)
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => {
    if (resetTimer.current !== undefined) clearTimeout(resetTimer.current)
  }, [])

  const copy = useCallback(async (): Promise<void> => {
    try {
      await copyText(text)
      setCopied(true)
      if (resetTimer.current !== undefined) clearTimeout(resetTimer.current)
      resetTimer.current = setTimeout(() => { setCopied(false) }, 1600)
    } catch {
      setCopied(false)
    }
  }, [text])

  return (
    <button
      type="button"
      className={css.copy}
      onClick={() => void copy()}
      aria-label={t('action.copyDescription')}
      title={t('action.copyDescription')}
    >
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <rect x="7" y="3" width="9" height="11" rx="2" />
        <path d="M13 16H6a2 2 0 0 1-2-2V7" />
      </svg>
      <span>{copied ? t('status.copied') : t('action.copy')}</span>
    </button>
  )
}
