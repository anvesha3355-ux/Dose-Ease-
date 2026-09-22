/**
 * DoseEase Notification & Audio Engine
 * Provides accessible audio chimes, web notifications, and reminder time parsing.
 */

// Helper to convert "08:30 AM" or "8:30 PM" or "20:30" to total minutes from midnight
export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return -1;
  const clean = timeStr.trim();

  // Check 12-hour format with AM/PM
  const match12 = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = parseInt(match12[2], 10);
    const ampm = match12[3]?.toUpperCase();

    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }

  // Check 24-hour format "HH:MM"
  const match24 = clean.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const minutes = parseInt(match24[2], 10);
    return hours * 60 + minutes;
  }

  return -1;
}

// Convert Date object to minute of day
export function getNowMinutes(d = new Date()): number {
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Plays a senior-friendly high-contrast chime using the Web Audio API.
 * Does not require external audio assets and works offline.
 */
export function playMedicationChime(highVolume = false): void {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const masterGain = ctx.createGain();
    const peakVolume = highVolume ? 0.35 : 0.2;
    masterGain.gain.setValueAtTime(0.001, ctx.currentTime);
    masterGain.gain.exponentialRampToValueAtTime(peakVolume, ctx.currentTime + 0.05);
    masterGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    masterGain.connect(ctx.destination);

    // First tone (pleasant warm sine)
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc1.connect(masterGain);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.5);

    // Second ascending tone (crisp notification chime)
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.3); // A5
    osc2.connect(masterGain);
    osc2.start(ctx.currentTime + 0.3);
    osc2.stop(ctx.currentTime + 1.2);
  } catch (err) {
    console.warn('[DoseEase Audio] Could not play audio chime:', err);
  }
}

/**
 * Checks and requests browser Notification permission.
 */
export async function requestNotificationPermission(): Promise<'granted' | 'denied' | 'default' | 'unsupported'> {
  if (!('Notification' in window)) {
    return 'unsupported';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  try {
    const perm = await Notification.requestPermission();
    return perm;
  } catch {
    return Notification.permission || 'denied';
  }
}

/**
 * Dispatches an OS/browser level notification if permission is granted.
 */
export function sendBrowserNotification(title: string, options?: NotificationOptions): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  try {
    const notif = new Notification(title, {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'doseease-med-reminder',
      requireInteraction: true,
      ...options,
    });

    notif.onclick = () => {
      window.focus();
      notif.close();
    };
  } catch (err) {
    console.warn('[DoseEase] Failed to show system notification:', err);
  }
}

/**
 * Checks if SpeechSynthesis is available in current browser environment.
 */
export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/**
 * Speaks arbitrary text in a calm, clear, senior-optimized voice cadence.
 */
export function speakText(
  text: string,
  options?: { rate?: number; pitch?: number; volume?: number; onEnd?: () => void }
): void {
  if (!isSpeechSupported()) return;

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    // 0.88x speed is optimal for elderly auditory comprehension
    utterance.rate = options?.rate ?? 0.88;
    utterance.pitch = options?.pitch ?? 1.0;
    utterance.volume = options?.volume ?? 1.0;

    if (options?.onEnd) {
      utterance.onend = options.onEnd;
    }

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('[DoseEase Speech] Could not synthesize speech:', err);
  }
}

/**
 * Stops any active speech synthesis.
 */
export function stopSpeaking(): void {
  if (isSpeechSupported()) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
}

/**
 * Generates and speaks a friendly, comprehensive daily routine briefing for the senior.
 */
export function speakDailyScheduleBriefing(
  seniorName: string,
  logs: Array<{ medicationName: string; dosage: string; scheduledTime: string; mealTiming?: string; status: string }>,
  onEnd?: () => void
): void {
  if (!isSpeechSupported()) return;

  if (logs.length === 0) {
    speakText(
      `Good day, ${seniorName}. You have no medications scheduled for today. Have a restful and healthy day!`,
      { onEnd }
    );
    return;
  }

  const pendingDoses = logs.filter(
    (l) => l.status.toLowerCase() !== 'taken' && l.status.toLowerCase() !== 'taken_later'
  );
  const takenCount = logs.length - pendingDoses.length;

  let script = `Hello ${seniorName}! Here is your medicine schedule for today. `;
  if (takenCount > 0) {
    script += `You have already taken ${takenCount} dose${takenCount > 1 ? 's' : ''}. `;
  }

  if (pendingDoses.length === 0) {
    script += `Congratulations! All of your doses for today are complete. Drink plenty of water!`;
  } else {
    script += `You have ${pendingDoses.length} upcoming dose${pendingDoses.length > 1 ? 's' : ''} left to take. `;
    pendingDoses.forEach((dose, index) => {
      const foodText = dose.mealTiming ? ` ${dose.mealTiming.replace('_', ' ')}.` : '.';
      script += `Number ${index + 1}: At ${dose.scheduledTime}, take ${dose.medicationName}, ${dose.dosage}${foodText} `;
    });
    script += `Please make sure to have water ready, and confirm each dose in DoseEase once taken.`;
  }

  speakText(script, { onEnd });
}
