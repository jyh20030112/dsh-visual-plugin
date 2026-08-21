import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { VideoClientController } from './video-client-controller.ts';
/** Shared injected face for the compact input entries. */
export interface VideoUploadInjected {
    videoController: VideoClientController;
}
type UploadButtonProps = PropsRuntime<'conversation.input.left'> & InjectFace<VideoUploadInjected> & PropsLocale<'vision-bridge'>;
type UploadDockProps = PropsRuntime<'conversation.input.dock'> & InjectFace<VideoUploadInjected> & PropsLocale<'vision-bridge'>;
/** Plugin-owned video file picker inside the conversation tool row. */
export declare function VideoUploadButton(props: UploadButtonProps): JSX.Element;
/** Full-width progress/error row shown only while an upload needs attention. */
export declare function VideoUploadDock(props: UploadDockProps): JSX.Element | null;
export {};
