const SUCCESS_SOUND_URL = "/sounds/scan-success.wav";

let successAudio: HTMLAudioElement | null = null;
let audioPreloaded = false;

export function preloadScanSuccessSound() {
  if (audioPreloaded || typeof window === "undefined") return;
  audioPreloaded = true;
  try {
    successAudio = new Audio(SUCCESS_SOUND_URL);
    successAudio.preload = "auto";
    successAudio.volume = 0.65;
    void successAudio.load();
  } catch {
    successAudio = null;
  }
}

export function playScanSuccessSound() {
  if (typeof window === "undefined") return;
  try {
    if (!successAudio) {
      successAudio = new Audio(SUCCESS_SOUND_URL);
      successAudio.volume = 0.65;
    }
    successAudio.currentTime = 0;
    void successAudio.play().catch(() => {
      playFallbackTone();
    });
  } catch {
    playFallbackTone();
  }
}

function playFallbackTone() {
  if (typeof window === "undefined") return;
  try {
    const ctx = new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    )();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
    osc.onended = () => void ctx.close();
  } catch {
    /* silent */
  }
}

export function triggerHaptic(status: string) {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  switch (status) {
    case "ok":
    case "valid":
      navigator.vibrate(50);
      break;
    case "invalid":
    case "already_scanned":
      navigator.vibrate([40, 30, 40]);
      break;
    default:
      navigator.vibrate([40, 30, 40]);
  }
}
