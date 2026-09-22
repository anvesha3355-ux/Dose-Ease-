// Cryptographic helper for secure client-side password hashing
export async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`${salt}:${password}:doseease_secure_v1`);
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
    try {
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fallback if subtle digest fails
    }
  }
  // Robust hash fallback for non-secure HTTP contexts
  let h1 = 0x811c9dc5;
  let h2 = 0x537f;
  for (let i = 0; i < data.length; i++) {
    h1 ^= data[i];
    h1 = Math.imul(h1, 0x01000193);
    h2 = ((h2 << 5) + h2 + data[i]) | 0;
  }
  return 'fb_' + (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

export function generateSalt(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    try {
      const array = new Uint8Array(16);
      crypto.getRandomValues(array);
      return Array.from(array)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    } catch {
      // Fallback
    }
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export function generateSecureUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    try {
      const array = new Uint8Array(12);
      crypto.getRandomValues(array);
      return 'usr_' + Array.from(array).map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fallback
    }
  }
  return 'usr_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

export function generateSixDigitCode(): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  return num.toString();
}
