import confetti from 'canvas-confetti';

// --- Confetti effects ---
export const launchConfetti = () => {
  try {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });
  } catch (e) {
    console.warn("Confetti error:", e);
  }
};

export const launchBigCelebration = () => {
  try {
    const duration = 2.5 * 1000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 55,
        origin: { x: 0 }
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 55,
        origin: { x: 1 }
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  } catch (e) {
    console.warn("Celebration error:", e);
  }
};

// --- Web Audio Chimes & Sounds ---
let audioCtx: AudioContext | null = null;
const getAudioContext = () => {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
};

export const playCorrectBeep = () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1); // A5
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch (e) {
    console.warn("Audio error", e);
  }
};

export const playSuccessFanfare = () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.1);
      gain.gain.setValueAtTime(0.2, now + idx * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.28);
      osc.start(now + idx * 0.1);
      osc.stop(now + idx * 0.1 + 0.3);
    });
  } catch (e) {
    console.warn("Audio error", e);
  }
};

export const playErrorTone = () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch (e) {
    console.warn("Audio error", e);
  }
};

export const playAlarmBeep = () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const playBeep = (startTime: number, freq: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.25, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.25);
      osc.start(startTime);
      osc.stop(startTime + 0.25);
    };
    playBeep(now, 660);
    playBeep(now + 0.35, 660);
    playBeep(now + 0.7, 880);
  } catch (e) {
    console.warn("Alarm error", e);
  }
};

// Gentle two-note notification chime when a letter arrives
export const playMailChime = () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [587.33, 880]; // D5 then A5
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.15);
      gain.gain.setValueAtTime(0.18, now + idx * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.15 + 0.3);
      osc.start(now + idx * 0.15);
      osc.stop(now + idx * 0.15 + 0.32);
    });
  } catch (e) {
    console.warn("Mail chime error", e);
  }
};

// Helper to strip all emoji symbols and pictorial glyphs so TTS does not speak labels like "клубника" or "сердечко"
export const stripEmojis = (str: string): string => {
  return str
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{200D}\u{FE0F}]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

// --- Web Speech API ---
export const speakRussianText = (text: string, onEnd?: () => void) => {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  
  // Clean all emojis and verbalize math signs explicitly (e.g. 6-2 -> 6 минус 2, 5+1 -> 5 плюс 1)
  let cleaned = stripEmojis(text)
    .replace(/(\d+)\s*-\s*(\d+)/g, '$1 минус $2')
    .replace(/(\d+)\s*\+\s*(\d+)/g, '$1 плюс $2')
    .replace(/\s*-\s*/g, ' минус ')
    .replace(/\s*\+\s*/g, ' плюс ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!cleaned) {
    if (onEnd) onEnd();
    return;
  }

  const utterance = new SpeechSynthesisUtterance(cleaned);
  utterance.lang = 'ru-RU';
  utterance.rate = 0.95;
  utterance.pitch = 1.1;

  const voices = window.speechSynthesis.getVoices();
  const ruVoice = voices.find(v => v.lang.startsWith('ru') && v.name.includes('Google')) ||
                  voices.find(v => v.lang.startsWith('ru'));
  if (ruVoice) {
    utterance.voice = ruVoice;
  }
  if (onEnd) {
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
  }
  window.speechSynthesis.speak(utterance);
};

// --- IndexedDB for custom recorded voice ---
const DB_NAME = "TypeCatAudioDB_V30";
const STORE_NAME = "audioBlobs";

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
    request.onerror = (event) => reject((event.target as IDBOpenDBRequest).error);
  });
};

export const saveAudioBlob = async (key: string, blob: Blob) => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(blob, key.toUpperCase());
  } catch (e) {
    console.error("Failed to save audio", e);
  }
};

export const getAudioBlob = async (key: string): Promise<Blob | null> => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(key.toUpperCase());
    return new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
};

export const playCustomOrSpeech = async (text: string, onEnd?: () => void) => {
  const blob = await getAudioBlob(text);
  if (blob) {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    if (onEnd) {
      audio.onended = () => {
        URL.revokeObjectURL(url);
        onEnd();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        onEnd();
      };
    }
    audio.play().catch(() => {
      speakRussianText(text, onEnd);
    });
  } else {
    speakRussianText(text, onEnd);
  }
};
