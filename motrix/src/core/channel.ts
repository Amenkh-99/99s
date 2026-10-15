/** Communication locale entre la présentation et la vue présentateur (sans serveur). */

export type PresenterCommand =
  | { type: 'cmd'; action: 'next' | 'prev' | 'nextScene' | 'prevScene' | 'first' | 'last' }
  | { type: 'cmd'; action: 'goto'; scene: number; step?: number }
  | { type: 'cmd'; action: 'toggleSkip'; scene: number }
  | { type: 'hello' };

export interface PresenterState {
  type: 'state';
  scene: number;
  step: number;
  skipped: number[];
}

export type ChannelMessage = PresenterCommand | PresenterState;

export function openChannel(onMessage: (m: ChannelMessage) => void): { post: (m: ChannelMessage) => void; close: () => void } {
  if (typeof BroadcastChannel === 'undefined') return { post: () => {}, close: () => {} };
  const ch = new BroadcastChannel('motrix-presentation');
  ch.onmessage = (e: MessageEvent<ChannelMessage>) => onMessage(e.data);
  return { post: (m) => ch.postMessage(m), close: () => ch.close() };
}

/** Préférences locales (facultatives : l'application fonctionne sans stockage). */
export const prefs = {
  get<T>(key: string, fallback: T): T {
    try {
      const v = localStorage.getItem(`motrix.${key}`);
      return v === null ? fallback : (JSON.parse(v) as T);
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown): void {
    try {
      localStorage.setItem(`motrix.${key}`, JSON.stringify(value));
    } catch {
      /* stockage indisponible : préférence non mémorisée */
    }
  },
};
