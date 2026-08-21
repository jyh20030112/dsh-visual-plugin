import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { VideoClientController } from './video-client-controller.ts'
import css from './VideoUploadButton.module.css'

const VIDEO_ACCEPT = '.mp4,.m4v,.mov,.avi,.mpg,.mpeg,.mkv,.webm,video/mp4,video/quicktime,video/x-msvideo,video/mpeg,video/webm'

/** Shared injected face for the compact input entries. */
export interface VideoUploadInjected {
  videoController: VideoClientController
}

type UploadButtonProps = PropsRuntime<'conversation.input.left'>
  & InjectFace<VideoUploadInjected>
  & PropsLocale<'vision-bridge'>

type UploadDockProps = PropsRuntime<'conversation.input.dock'>
  & InjectFace<VideoUploadInjected>
  & PropsLocale<'vision-bridge'>

function useVideoState(controller: VideoClientController, sessionId: string) {
  return useSyncExternalStore(
    listener => controller.subscribe(sessionId, listener),
    () => controller.snapshot(sessionId),
    () => controller.snapshot(sessionId),
  )
}

/** Plugin-owned video file picker inside the conversation tool row. */
export function VideoUploadButton(props: UploadButtonProps): JSX.Element {
  const sessionId = String(props.sessionId)
  const input = useRef<HTMLInputElement>(null)
  const state = useVideoState(props.videoController, sessionId)
  const busy = state.phase !== 'idle'
  return (
    <>
      <input
        ref={input}
        className={css.hiddenInput}
        type="file"
        accept={VIDEO_ACCEPT}
        disabled={busy}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (file !== undefined) void props.videoController.upload(sessionId, file).catch(() => {})
        }}
      />
      <button
        type="button"
        className={css.uploadButton}
        disabled={busy}
        aria-label={props.t('video.upload')}
        title={props.t('video.upload')}
        onClick={() => input.current?.click()}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15.5 8.5 9.7 4.9A1.1 1.1 0 0 0 8 5.8v7.4a1.1 1.1 0 0 0 1.7.9l5.8-3.6a1.2 1.2 0 0 0 0-2Z" />
          <path d="M5 3.5h14A1.5 1.5 0 0 1 20.5 5v14A1.5 1.5 0 0 1 19 20.5H5A1.5 1.5 0 0 1 3.5 19V5A1.5 1.5 0 0 1 5 3.5Z" />
        </svg>
      </button>
    </>
  )
}

/** Full-width progress/error row shown only while an upload needs attention. */
export function VideoUploadDock(props: UploadDockProps): JSX.Element | null {
  const sessionId = String(props.sessionId)
  const state = useVideoState(props.videoController, sessionId)
  const appliedSelection = useRef<number | undefined>(undefined)
  useEffect(() => {
    const selection = state.selection
    if (selection === undefined || appliedSelection.current === selection.token) return
    const video = state.videos.find(item => item.videoId === selection.videoId)
    if (video === undefined) return
    appliedSelection.current = selection.token
    props.inputActions.setDraft(`[视频] ${video.fileName}\n[视频ID] ${video.videoId}\n请描述这个视频中发生了什么？`)
  }, [props.inputActions, state.selection, state.videos])
  if (state.phase === 'idle' && state.error === undefined) return null
  const percentage = Math.round(state.progress * 100)
  return (
    <div className={state.error === undefined ? css.dock : `${css.dock} ${css.dockError}`}>
      <div className={css.dockTopline}>
        <span>{state.error ?? (state.phase === 'processing'
          ? props.t('video.processing')
          : props.t('video.uploading', { progress: String(percentage) }))}</span>
        {state.activeFileName !== undefined && <span className={css.fileName}>{state.activeFileName}</span>}
      </div>
      {state.error === undefined && (
        <div className={css.progressTrack} aria-label={props.t('video.uploadProgress')}>
          <span style={{ width: `${percentage}%` }} />
        </div>
      )}
    </div>
  )
}
