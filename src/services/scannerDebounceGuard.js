/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛡️ MES CENTRUM ENTERPRISE: BARCODE SCANNER HARDWARE RACE & DEBOUNCE GUARD
 * ═══════════════════════════════════════════════════════════════════════════
 * Protects production terminals (Shop1, Shop2, Operator, Tumbling, Sorting, Reception)
 * from rapid double-triggering by laser/Bluetooth barcode scanners.
 * 
 * Features:
 *  - 700ms cooldown window per identical barcode
 *  - In-flight async execution locking (prevents race conditions while HTTP request is pending)
 *  - Automatic memory pruning (bounded RAM consumption during 12h shifts)
 *  - Failsafe timeout on locks (prevents deadlock if network request hangs)
 */

/**
 * Safe industrial audio & haptic feedback for tablet barcode scanners
 * @param {boolean} isSuccess 
 */
// Base64 8-bit PCM audio chimes for bulletproof zero-latency playback fallback
const CHIME_SUCCESS_WAV = 'data:audio/wav;base64,UklGRk8FAABXQVZFZm10IBAAAAABAAEAESsAABErAAABAAgAZGF0YSsFAACAueT268aPVSYNEC9hm83t8dmsdD8aDh9HfLPc7ubEkVstFRYyYJbG5erVrHdFIhYjSHqt1OfgwpNgNRwcNV+Sv93k0qx7TCkcKEl3p83g27+UZDsjIjhfjrnW3c6rflEwIyxKdaLH2da9lmlCKic7Xoqzz9jKqoBWNykxTHOewdPRu5dsRzAtPV6HrsnSx6qDWzwvNU1ymrvNzbmXcE02MkBehanDzcOphV9CNDlPcZa2yMi3mHNSPDZDX4KlvsjAqIZjRzk8UHCTscPEtJh2VkE7Rl+AobnDvaeIZ0w+QFJvkKy+wLKYeFpFP0lgfp20v7mmiWpQQ0RUbo2oubywmHpeSkNLYH2asLq2pYptVUdHVW6KpLW4rph8YU5HTmF7l6y3s6SLcFhLSldtiKGxtayYfmVSS1BiepSos7GijHJcT01ZbYadrbKqmIBoVk5TYnmRpa+uoYx0X1JQWm2EmqqvqJeBallRVWN4j6Ksq6CNdmJWU1xtg5imrKaXgm1cVVdkd42fqamfjXhlWVZdbYGVo6mkloNvX1dZZXeLnKamnY16aFxYX22Ak6CmopaEcWJaXGZ2iZmjpJyNe2peW2Buf5Geo6CVhXNlXV5ndoeXoKKbjXxsYV1ibn6Pm6GflIV1Z19faHaGlZ6gmo19bmNfY259jZmfnZSGdmlhYWl1hZOcnpmNfnBmYWVvfYuXnZuThnhrZGNpdYSRmpyXjX9yaGNmb3yKlZuakod5bWZlanWCj5ialo2Ac2plZ3B7iJOZmJKHem9oZmt1go2WmZWNgXVrZ2lwe4eRl5eRh3twaWhsdYGMlJeUjIF2bWlqcHuGkJWWkId8cmtpbXWAi5KVk4yCd29qa3F6hY6UlJCHfXNta251f4mRlJKMgnhwbGxyeoSNkpOPh350bmxvdn+Ij5ORi4N5cW1tcnqDjJGSjod+dm9tcHZ+h46RkIuDenNubnN6g4qQkY6Hf3dxbnB2foaNkI+Lg3t0cG9zeoKJjpCNh394cm9xdn6FjI+OioN8dXFwdHqBiI2PjIeAeHNxcnd9hYuOjoqEfHZycXR6gYiMjoyHgHl0cnN3fYSKjY2JhH13c3J1eoCHi42Lh4B6dXJzd32DiYyMiYR9eHRzdXqAhoqMi4eBe3ZzdHd9g4iLi4mEfnh1dHZ6gIWJi4qGgXt3dHV4fYKHiouIhH55dXR2en+FiYqKhoF8d3V1eHyChomKiIR/enZ1dnp/hIiKiYaBfHh2dnh8gYaJiYiEf3p3dnd6f4OHiYiGgn15dnZ4fIGFiImHhH97eHZ3en+Dh4iIhoJ9eXd3eXyBhYeIh4SAe3h3eHp+g4aIiIWCfnp4d3l8gISHiIaEgHx5eHh7foKFh4eFgn56eHh5fICEhoeGhIB8eXh5e36ChYeHhYJ+e3l4enyAg4aHhoOAfXp5eXt+gYSGhoWCf3t5eXp8gIOFhoWDgH16eXl7foGEhoaEgn98enl6fH+ChYaFg4B9e3p6e36BhIWFhIJ/fHp6enx/goSFhYOBfnt6ent+gYOFhYSCf317ent9f4KEhYWDgX58enp8foCDhIWEgn99e3p7fX+ChIWEg4F+fHt7fH6AgoSEhIJ/fXt7e31/gYOEhIOBfnx7e3x+gIKEhIOCgH18e3t9f4GDhISDgX99e3t8foCCg4SDgoB+fHt8fX+Bg4SEg4F/fXx7fH6AgoOEg4KAfnx8fH1/gYKDg4KBf318fHx+gIGDg4OCgH59fHx9f4CCg4OCgX8=';

const BUZZ_ERROR_WAV = 'data:audio/wav;base64,UklGRsEIAABXQVZFZm10IBAAAAABAAEAESsAABErAAABAAgAZGF0YZ0IAAAIDBEWGyAlKi80OT1CR0xQVVpfY2htcXZ7f4SIjZKWm5+kqK2xtbq+w8fL0NTY3eHl6u4VGR4iJyswNTk9QkZLT1RYXGFlaW5ydnt/g4eLkJSYnKClqa2xtbm9wcXJzdHV2d3h5RwhJSktMTY6PkJGSk5SVltfY2drb3N3en6ChoqOkpaanaGlqa2wtLi8v8PHy87S1tndJCcrLzM3Oz9CRkpOUlVZXWFkaGxvc3d6foKFiYyQlJebnqKlqayws7e6vsHEyMvP0tUqLjE1OTxAQ0dKTlFVWFxfY2ZpbXB0d3p+gYSIi46SlZicn6KlqKyvsrW4vL/CxcjLzjA0Nzo+QURHS05RVFhbXmFkaGtucXR3en6BhIeKjZCTlpmcn6KlqKuusbS3ury/wsXINjk8P0JFSEtOUVRXWl1gY2ZpbG9ydXh7fYCDhomMjpGUl5qcn6Klp6qtr7K1uLq9wMI7PkFER0lMT1JVV1pdYGJlaGttcHN1eHt9gIOFiIqNkJKVl5qcn6GkpqmsrrCztbi6vUBDRUhLTVBSVVhaXV9iZGdpbG5xc3Z4e32AgoSHiYyOkJOVmJqcn6GjpqiqrK+xs7a4ukdKTE5RU1ZYWl1fYWRmaGttb3J0dnl7fX+ChIaIio2PkZOVmJqcnqCipaepq62vsbO1S05QUlRWWVtdX2FkZmhqbG5wc3V3eXt9f4GDhYeJi42QkpSWmJqcnqCho6Wnqautr7FPUVNVV1lbXV9hY2VnaWttb3FzdXd5e31/gYOFh4iKjI6QkpSWl5mbnZ+hoqSmqKmrrVNUVlhaXF5gYmRlZ2lrbW9wcnR2eHl7fX+BgoSGiImLjY6QkpSVl5manJ6foaOkpqipVlhZW11fYGJkZWdpa2xucHFzdXZ4ent9f4CChIWHiIqMjY+QkpOVl5iam52eoKGjpKZZWlxeX2FiZGZnaWpsbm9xcnR1d3h6e31/gIKDhYaIiYqMjY+QkpOVlpiZmpydn6Cio1xdX2BiY2VmZ2lqbG1vcHJzdXZ3eXp8fX6AgYOEhYeIiYuMjo+QkpOUlpeYmpucnZ+gXmBhYmRlZmhpa2xtb3Bxc3R1d3h5enx9foCBgoSFhoeJiouMjo+QkZOUlZaXmZqbnJ1hYmNkZmdoaWtsbW5wcXJzdXZ3eHp7fH1+gIGCg4SFh4iJiouMjo+QkZKTlJWXmJmam5xkZWZoaWprbG1ucHFyc3R1dnh5ent8fX5/gIKDhIWGh4iJiouMjY6PkZKTlJWWl5iZmmZnaGlqa2xub3BxcnN0dXZ3eHl6e3x9fn+AgYKDhIWGh4iJiouMjY6PkJGSk5SVlpeYaGlqa2xtbm9wcXJzdHV2d3h5enp7fH1+f4CBgoOEhYaHiIiJiouMjY6PkJCRkpOUlZZpamtsbW5vcHFyc3R1dXZ3eHl6e3x9fX5/gIGCg4OEhYaHiIiJiouMjY2Oj5CRkpKTlGtsbW5vb3BxcnN0dHV2d3h5eXp7fH19fn+AgYGCg4SFhYaHiIiJiouMjI2Oj4+QkZKSbW1ub3BxcXJzdHR1dnd3eHl6e3t8fX5+f4CAgYKDg4SFhoaHiIiJiouLjI2Njo+PkJFub29wcXJyc3R0dXZ3d3h5eXp7fHx9fn5/gICBgoKDhISFhoaHiIiJioqLjIyNjY6Pj29wcXFyc3N0dXV2d3d4eXl6ent8fH1+fn+AgIGBgoODhIWFhoaHiIiJiYqLi4yMjY6OcHFycnNzdHV1dnd3eHh5enp7e3x9fX5+f3+AgYGCgoOEhIWFhoaHh4iJiYqKi4uMjI2NcnNzdHR1dXZ3d3h4eXl6e3t8fH19fn5/f4CBgYKCg4OEhIWFhoaHh4iIiYmKiouLjIxzdHR1dXZ2d3d4eHl5enp7e3x8fX1+fn9/gICBgYKCg4OEhIWFhoaHh4iIiYmJioqLi3R0dXV2dnd3eHh5eXp6e3t8fH19fX5+f3+AgIGBgoKDg4OEhIWFhoaGh4eIiImJioqKdXV2dnd3d3h4eXl6ent7e3x8fX1+fn5/f4CAgYGBgoKDg4OEhIWFhoaGh4eIiIiJiYl2dnZ3d3h4eHl5enp6e3t8fH19fX5+fn9/gICAgYGCgoKDg4SEhIWFhYaGhoeHiIiIiXZ3d3d4eHl5eXp6ent7fHx8fX19fn5/f3+AgICBgYGCgoKDg4SEhIWFhYaGhoeHh4iId3d4eHh5eXl6enp7e3t8fH19fX5+fn9/f4CAgIGBgYKCgoODg4OEhISFhYWGhoaHh4d4eHh5eXl5enp6e3t7fHx8fX19fn5+f39/gICAgIGBgYKCgoODg4OEhISFhYWFhoaGh3h4eXl5enp6e3t7e3x8fH19fX1+fn5/f39/gICAgYGBgYKCgoODg4OEhISEhYWFhoaGhnl5eXp6ent7e3t8fHx9fX19fn5+fn9/f3+AgICBgYGBgoKCgoODg4OEhISEhYWFhYaGeXp6enp7e3t7fHx8fH19fX1+fn5+f39/f4CAgICBgYGBgoKCgoODg4ODhISEhIWFhYV6enp7e3t7e3x8fHx9fX19fn5+fn9/f39/gICAgIGBgYGBgoKCgoKDg4ODhISEhISFhXp6e3t7e3x8fHx8fX19fX5+fn5+f39/f3+AgICAgIGBgYGBgoKCgoKDg4ODg4SEhISEe3t7e3t8fHx8fH19fX19fn5+fn5/f39/f4CAgICAgYGBgYGBgoKCgoKDg4ODg4OEhIR7e3t8fHx8fHx9fX19fX5+fn5+fn9/f39/gICAgICAgYGBgYGBgoKCgoKCg4ODg4ODhHt7fHx8fHx9fX19fX1+fn5+fn5/f39/f3+AgICAgICAgYGBgYGBgoKCgoKCg4ODg4ODfHx8fHx8fX19fX19fn5+fn5+fn9/f39/f4CAgICAgICBgYGBgYGBgoKCgoKCgoODg4M=';

function playAudioFallback(isSuccess) {
  try {
    if (typeof Audio === 'undefined') return;
    const audio = new Audio(isSuccess ? CHIME_SUCCESS_WAV : BUZZ_ERROR_WAV);
    audio.volume = isSuccess ? 0.9 : 0.7;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {});
    }
  } catch {}
}

/**
 * Safe industrial audio & haptic feedback for tablet barcode scanners
 * @param {boolean} isSuccess 
 */
export function triggerHapticAudioFeedback(isSuccess) {
  try {
    // 1. Dual/Multi-pulse Vibration for distinct physical feedback
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        if (isSuccess) {
          // Sharp double-pulse: 180ms on, 60ms pause, 180ms on
          navigator.vibrate([180, 60, 180]);
        } else {
          // Harsh triple warning pulse
          navigator.vibrate([300, 100, 300, 100, 300]);
        }
      } catch {}
    }

    // 2. Web Audio API synthesized industrial tone
    const AudioContextClass = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AudioContextClass) {
      playAudioFallback(isSuccess);
      return;
    }

    if (!triggerHapticAudioFeedback.audioCtx || triggerHapticAudioFeedback.audioCtx.state === 'closed') {
      triggerHapticAudioFeedback.audioCtx = new AudioContextClass();
    }
    const ctx = triggerHapticAudioFeedback.audioCtx;

    const emitTone = () => {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const now = ctx.currentTime;

        if (isSuccess) {
          // Pure industrial chime 880 Hz (A5), loud & crisp
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, now);
          gain.gain.setValueAtTime(0.85, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.15);
        } else {
          // Harsh reject buzz 220 Hz (A3) sawtooth
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(220, now);
          gain.gain.setValueAtTime(0.65, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.22);
        }
      } catch {
        playAudioFallback(isSuccess);
      }
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(emitTone).catch(() => playAudioFallback(isSuccess));
    } else {
      emitTone();
    }
  } catch {
    playAudioFallback(isSuccess);
  }
}

// Pre-unlock AudioContext and Audio elements on ANY user gesture (tap, click, pointer, key)
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        if (!triggerHapticAudioFeedback.audioCtx || triggerHapticAudioFeedback.audioCtx.state === 'closed') {
          triggerHapticAudioFeedback.audioCtx = new AudioContextClass();
        }
        if (triggerHapticAudioFeedback.audioCtx.state === 'suspended') {
          triggerHapticAudioFeedback.audioCtx.resume().catch(() => {});
        }
      }
      // Prime haptic vibration permissions on user tap
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try { navigator.vibrate(10); } catch {}
      }
    } catch {}
  };

  ['pointerdown', 'touchstart', 'touchend', 'click', 'keydown'].forEach(evt => {
    window.addEventListener(evt, unlockAudio, { passive: true, capture: true });
  });
}

class ScannerDebounceGuard {
  constructor(defaultCooldownMs = 700, maxLockTimeoutMs = 6000) {
    this.defaultCooldownMs = defaultCooldownMs;
    this.maxLockTimeoutMs = maxLockTimeoutMs;
    this.lastScanTimestamps = new Map(); // key -> timestamp
    this.inFlightLocks = new Map(); // key -> setTimeout timer ID
    this.maxTrackedCodes = 150;
  }

  /**
   * Normalize barcode / card identifier for robust key comparison
   * @param {string} rawCode
   * @returns {string}
   */
  normalize(rawCode) {
    if (!rawCode) return '';
    return String(rawCode)
      .trim()
      .replace(/^CENTRUM_CARD_/i, '')
      .replace(/^#/, '')
      .toLowerCase();
  }


  /**
   * Determine whether the incoming scan should be processed or dropped
   * @param {string} rawCode 
   * @param {number} [cooldownMs] 
   * @returns {boolean} true if valid to process, false if rapid duplicate/locked
   */
  shouldProcessScan(rawCode, cooldownMs = this.defaultCooldownMs) {
    const key = this.normalize(rawCode);
    if (!key) {
      triggerHapticAudioFeedback(false);
      return false;
    }

    const now = Date.now();

    // 1. Check in-flight lock (operation is already in progress)
    if (this.inFlightLocks.has(key)) {
      console.warn(`[ScannerGuard] Scan dropped: In-flight lock active for "${key}"`);
      triggerHapticAudioFeedback(false);
      return false;
    }

    // 2. Check cooldown window (anti-bounce)
    const lastTime = this.lastScanTimestamps.get(key) || 0;
    if (now - lastTime < cooldownMs) {
      console.warn(`[ScannerGuard] Scan dropped: Debounce active (${now - lastTime}ms < ${cooldownMs}ms) for "${key}"`);
      triggerHapticAudioFeedback(false);
      return false;
    }

    // 3. Mark timestamp and prune if necessary
    this.lastScanTimestamps.set(key, now);
    this._pruneStaleEntries(now);

    triggerHapticAudioFeedback(true);
    return true;
  }

  /**
   * Lock a barcode during async processing
   * @param {string} rawCode 
   * @returns {boolean} true if acquired, false if already locked
   */
  acquireLock(rawCode) {
    const key = this.normalize(rawCode);
    if (!key) return false;

    if (this.inFlightLocks.has(key)) {
      return false;
    }

    // Auto-release safety timer to guarantee no permanent lock if an unhandled crash occurs
    const timerId = setTimeout(() => {
      this.releaseLock(key);
    }, this.maxLockTimeoutMs);

    this.inFlightLocks.set(key, timerId);
    return true;
  }

  /**
   * Release lock for a barcode after async processing completes
   * @param {string} rawCode 
   */
  releaseLock(rawCode) {
    const key = this.normalize(rawCode);
    if (!key) return;

    const timerId = this.inFlightLocks.get(key);
    if (timerId) {
      clearTimeout(timerId);
      this.inFlightLocks.delete(key);
    }
  }

  /**
   * Higher-order helper to wrap an async scanner handler with debounce + lock
   * @template T
   * @param {string} rawCode 
   * @param {() => Promise<T>} asyncFn 
   * @param {number} [cooldownMs] 
   * @returns {Promise<T|null>}
   */
  async withLock(rawCode, asyncFn, cooldownMs = this.defaultCooldownMs) {
    if (!this.shouldProcessScan(rawCode, cooldownMs)) {
      return null;
    }

    const key = this.normalize(rawCode);
    this.acquireLock(key);

    try {
      return await asyncFn();
    } finally {
      this.releaseLock(key);
    }
  }

  /**
   * Reset all state (useful for tests, shifts or user logout)
   */
  reset() {
    this.inFlightLocks.forEach((timerId) => clearTimeout(timerId));
    this.inFlightLocks.clear();
    this.lastScanTimestamps.clear();
  }

  /**
   * Internal garbage collector for bounded memory
   * @private
   */
  _pruneStaleEntries(now) {
    if (this.lastScanTimestamps.size > this.maxTrackedCodes) {
      const expirationThreshold = 60 * 1000; // 1 minute
      for (const [key, ts] of this.lastScanTimestamps.entries()) {
        if (now - ts > expirationThreshold) {
          this.lastScanTimestamps.delete(key);
        }
      }
    }
  }
}

// Export singleton instance as default and class for custom instances
export const scannerDebounceGuard = new ScannerDebounceGuard();
export default scannerDebounceGuard;
