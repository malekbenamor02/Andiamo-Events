/**
 * Admin dashboard notification sound — preload + unlock on user gesture.
 * Uses scan-success.wav until notification.mp3 is added.
 */

const NOTIFICATION_SOUND_URL = '/sounds/scan-success.wav';

let notificationAudio: HTMLAudioElement | null = null;
let audioPreloaded = false;
let audioUnlocked = false;
let audioContext: AudioContext | null = null;

export function isAdminNotificationAudioUnlocked(): boolean {
  return audioUnlocked;
}

export function unlockAdminNotificationAudio(): void {
  if (typeof window === 'undefined') return;
  audioUnlocked = true;
  preloadAdminNotificationSound();
  try {
    if (!audioContext) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (Ctx) audioContext = new Ctx();
    }
    if (audioContext?.state === 'suspended') {
      void audioContext.resume();
    }
    if (notificationAudio) {
      notificationAudio.muted = true;
      const p = notificationAudio.play();
      if (p && typeof p.then === 'function') {
        p.then(() => {
          if (notificationAudio) {
            notificationAudio.pause();
            notificationAudio.muted = false;
            notificationAudio.currentTime = 0;
          }
        }).catch(() => {
          if (notificationAudio) notificationAudio.muted = false;
        });
      }
    }
  } catch {
    // unlock best-effort
  }
}

export function preloadAdminNotificationSound(): void {
  if (audioPreloaded || typeof window === 'undefined') return;
  audioPreloaded = true;
  try {
    notificationAudio = new Audio(NOTIFICATION_SOUND_URL);
    notificationAudio.preload = 'auto';
    notificationAudio.volume = 0.6;
    void notificationAudio.load();
  } catch {
    notificationAudio = null;
  }
}

function playFallbackBeep(): void {
  if (typeof window === 'undefined') return;
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    if (!audioContext) audioContext = new Ctx();
    const ctx = audioContext;
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // silent
  }
}

export function playAdminNotificationSound(): void {
  if (typeof window === 'undefined') return;
  try {
    if (!notificationAudio) {
      notificationAudio = new Audio(NOTIFICATION_SOUND_URL);
      notificationAudio.volume = 0.6;
    }
    notificationAudio.currentTime = 0;
    void notificationAudio.play().catch(() => {
      playFallbackBeep();
    });
  } catch {
    playFallbackBeep();
  }
}

export function playAdminNotificationTestSound(): void {
  unlockAdminNotificationAudio();
  playAdminNotificationSound();
}
