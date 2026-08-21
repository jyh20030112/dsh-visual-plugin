import type { WebServer } from '@deepseek-ai/dsh-host-webserver';
import type { VideoCoordinator } from './types.ts';
interface VideoRouteOptions {
    sessionExists(sessionId: string): boolean;
}
/** Register the complete same-origin HTTP adapter over the coordinator interface. */
export declare function registerVideoRoutes(webServer: Pick<WebServer, 'register'>, coordinator: VideoCoordinator, options: VideoRouteOptions): () => void;
export {};
