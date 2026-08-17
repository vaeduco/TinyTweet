// A subtle "ping" for new in-app notifications/messages, plus a localStorage
// mirror of the user's sound preference (kept in sync with the DB by the push
// controller on load and by the Settings toggle on change). No audio asset —
// a short WebAudio blip keeps it tiny and theme-agnostic.

const KEY = "tt_notify_sound";

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(KEY) !== "0"; // default on
}

export function setSoundEnabled(on: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, on ? "1" : "0");
}

let ctx: AudioContext | null = null;

export function playPing(): void {
  if (typeof window === "undefined" || !isSoundEnabled()) return;
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return;
    ctx = ctx ?? new AC();
    // Browsers suspend audio until a user gesture; resume best-effort.
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(1174, now + 0.09); // gentle two-note lift
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.05, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.32);
  } catch {
    // Autoplay blocked / no audio device — silently skip.
  }
}
