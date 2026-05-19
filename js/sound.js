/**
 * sound.js
 * Управление музыкой и звуками.
 * Один экземпляр Audio, переиспользуем через src.
 */

import { CONFIG } from './config.js';

let bgMusic  = null;
let started  = false; // стартуем только после первого взаимодействия (политика браузеров)

// ─── Публичное API ─────────────────────────────────────────────────────────────

/** Вызвать при первом тапе пользователя */
export function startMusicOnce(trackSrc) {
  if (started) return;
  started = true;
  _play(trackSrc);
}

/** Сменить трек */
export function changeTrack(trackSrc) {
  if (bgMusic) {
    bgMusic.pause();
    bgMusic.src = '';
  }
  bgMusic = null;
  _play(trackSrc);
}

/** Воспроизвести короткий звук (ранг, покупка и т.д.) */
export function playSfx(src) {
  try {
    const sfx = new Audio(src);
    sfx.volume = 0.7;
    sfx.play();
  } catch (_) {}
}

// ─── Приватное ────────────────────────────────────────────────────────────────

function _play(src) {
  try {
    bgMusic        = new Audio(src);
    bgMusic.loop   = true;
    bgMusic.volume = CONFIG.MUSIC_VOLUME;
    const promise  = bgMusic.play();
    if (promise !== undefined) {
      promise.catch(() => {
        // autoplay заблокирован — попробуем после клика
        document.addEventListener('pointerdown', () => {
          bgMusic?.play().catch(() => {});
        }, { once: true });
      });
    }
  } catch (_) {}
}