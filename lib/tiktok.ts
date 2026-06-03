export function trackTikTokEvent(eventName: string, params?: object) {
  if (typeof window !== 'undefined' && window.ttq) {
    window.ttq.track(eventName, params ?? {});
  }
}